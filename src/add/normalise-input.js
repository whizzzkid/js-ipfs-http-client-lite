'use strict'
/* eslint-env browser */

const toIterator = require('pull-stream-to-async-iterator')
const { Buffer } = require('buffer')
const blobToAsyncIterable = require('../lib/blob-to-async-iterable')

/*
Transform one of:

Buffer/ArrayBuffer/TypedArray
Blob/File
{ path, content: Buffer }
{ path, content: Iterable<Buffer> }
{ path, content: AsyncIterable<Buffer> }
{ path, content: PullStream<Buffer> }
Iterable<Number>
Iterable<{ path, content: Buffer }>
Iterable<{ path, content: Iterable<Number> }>
Iterable<{ path, content: AsyncIterable<Buffer> }>
Iterable<{ path, content: PullStream<Buffer> }>
AsyncIterable<Buffer>
AsyncIterable<{ path, content: Buffer }>
AsyncIterable<{ path, content: Iterable<Buffer> }>
AsyncIterable<{ path, content: AsyncIterable<Buffer> }>
AsyncIterable<{ path, content: PullStream<Buffer> }>
PullStream<Buffer>

Into:

AsyncIterable<{ path, content: AsyncIterable<Buffer> }>
*/

module.exports = function normalizeInput (input) {
  // Buffer/ArrayBuffer/TypedArray
  if (Buffer.isBuffer(input) || ArrayBuffer.isView(input) || input instanceof ArrayBuffer) {
    return (async function * () { // eslint-disable-line require-await
      yield normalizeTuple({ path: '', content: input })
    })()
  }

  // Blob/File
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return (async function * () { // eslint-disable-line require-await
      yield normalizeTuple({ path: '', content: input })
    })()
  }

  // Iterable<Number>
  // Iterable<{ path, content: Buffer }>
  // Iterable<{ path, content: Iterable<Number> }>
  // Iterable<{ path, content: AsyncIterable<Buffer> }>
  // Iterable<{ path, content: PullStream<Buffer> }>
  if (input[Symbol.iterator]) {
    return (async function * () { // eslint-disable-line require-await
      for (const chunk of input) {
        if (typeof chunk === 'object' && (chunk.path || chunk.content)) {
          yield normalizeTuple(chunk)
        } else { // Must be an Iterable<Number> i.e. Buffer/ArrayBuffer/Array of bytes
          yield normalizeTuple({ path: '', content: input })
          return
        }
      }
    })()
  }

  // AsyncIterable<Buffer>
  // AsyncIterable<{ path, content: Buffer }>
  // AsyncIterable<{ path, content: Iterable<Buffer> }>
  // AsyncIterable<{ path, content: AsyncIterable<Buffer> }>
  // AsyncIterable<{ path, content: PullStream<Buffer> }>
  if (input[Symbol.asyncIterator]) {
    return (async function * () {
      for await (const chunk of input) {
        if (typeof chunk === 'object' && (chunk.path || chunk.content)) {
          yield normalizeTuple(chunk)
        } else { // Must be an AsyncIterable<Buffer> i.e. a Stream
          let path = ''

          // fs.createReadStream will create a stream with a `path` prop
          // If available, use it here!
          if (input.path && input.path.split) {
            path = input.path.split(/[/\\]/).pop() || ''
          }

          yield normalizeTuple({
            path,
            content: (async function * () {
              yield chunk
              for await (const restChunk of input) {
                yield restChunk
              }
            })()
          })
          return
        }
      }
    })()
  }

  // { path, content: Buffer }
  // { path, content: Iterable<Buffer> }
  // { path, content: AsyncIterable<Buffer> }
  // { path, content: PullStream<Buffer> }
  if (typeof input === 'object' && (input.path || input.content)) {
    // eslint-disable-next-line require-await
    return (async function * () { yield normalizeTuple(input) })()
  }

  // PullStream
  if (typeof input === 'function') {
    return (async function * () { // eslint-disable-line require-await
      yield normalizeTuple({ path: '', content: input })
    })()
  }

  throw new Error('Unexpected input: ' + typeof input)
}

function normalizeTuple ({ path, content }) {
  return { path: path || '', content: content ? toAsyncIterable(content) : null }
}

function toAsyncIterable (input) {
  // Buffer/ArrayBuffer/TypedArray/array of bytes
  if (input[Symbol.iterator]) {
    const buf = Buffer.from(input)
    return Object.assign(
      (async function * () { yield buf })(), // eslint-disable-line require-await
      { length: buf.length }
    )
  }

  // Blob/File
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return Object.assign(
      blobToAsyncIterable(input),
      { length: input.size }
    )
  }

  // AsyncIterable<Buffer>
  if (input[Symbol.asyncIterator]) {
    return (async function * () {
      for await (const chunk of input) {
        yield Buffer.from(chunk)
      }
    })()
  }

  // PullStream
  if (typeof input === 'function') {
    return toIterator(input)
  }

  throw new Error('Unexpected input: ' + typeof input)
}