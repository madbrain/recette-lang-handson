import {
  Readable,
  Transform,
  TransformCallback,
  TransformOptions,
} from "stream";

type ReceiveState = "headers" | "jsonrpc";

export class JSONRPCTransform extends Transform {
  private _state: ReceiveState;
  private _curContentLength: number;
  private _curContentType: BufferEncoding;
  private _curChunk: Buffer;

  private constructor(options?: TransformOptions) {
    options = options || {};
    options.objectMode = true;
    super(options);

    this.on("pipe", (src) => {
      if (!this.readableEncoding) {
        if (src instanceof Readable && src.readableEncoding) {
          this.setEncoding(src.readableEncoding);
        }
      }
    });

    this._curChunk = Buffer.from([]);
    this._state = "headers";
  }

  public _transform(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    done: TransformCallback
  ): void {
    // decode binary chunks as UTF-8
    encoding = encoding || "utf8";

    if (!Buffer.isBuffer(chunk)) {
      chunk = Buffer.from(chunk, encoding);
    }

    this._curChunk = Buffer.concat([this._curChunk, chunk]);

    const contentLengthRe = /^Content-Length: ([0-9]+)$/i;
    const contentTypeRe = /^Content-Type: ([^;]+)(; charset=(.*))?$/i;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this._state === "headers") {
        let start = 0;
        let end = 0;
        let foundEol = false;
        for (; end < this._curChunk.length - 1; ++end) {
          if (this._curChunk.toString(encoding, end, end + 2) == "\r\n") {
            foundEol = true;
            break;
          }
        }
        if (!foundEol) break;

        const line = this._curChunk.toString(encoding, start, end);
        if (line.length == 0) {
          this._state = "jsonrpc";
        } else {
          const matchContentLength = line.match(contentLengthRe);
          const matchContentType = line.match(contentTypeRe);
          if (matchContentLength) {
            this._curContentLength = Number(matchContentLength[1]);
          } else if (matchContentType) {
            this._curContentType = matchContentType[3] as BufferEncoding;
          } else {
            console.log("UNKNOWN HEADER", line);
          }
        }
        this._curChunk = this._curChunk.subarray(end + 2);
        continue;
      } else if (this._state === "jsonrpc") {
        if (this._curChunk.length >= this._curContentLength) {
          this.push(
            this._reencode(
              this._curChunk.subarray(0, this._curContentLength),
              this._curContentType || encoding
            )
          );
          this._curChunk = this._curChunk.subarray(this._curContentLength);
          this._state = "headers";

          continue;
        }
      }

      break;
    }
    done();
  }

  private _reencode(chunk: Buffer, chunkEncoding: BufferEncoding) {
    if (this.readableEncoding && this.readableEncoding != chunkEncoding) {
      return chunk.toString(this.readableEncoding);
    } else {
      // this should be the most common case, i.e. we're using an encoded source stream
      return chunk.toString(chunkEncoding);
    }
  }

  public static createStream(
    readStream?: Readable,
    options?: TransformOptions
  ): JSONRPCTransform {
    const jrt = new JSONRPCTransform(options);
    if (readStream) {
      readStream.pipe(jrt);
    }
    return jrt;
  }
}
