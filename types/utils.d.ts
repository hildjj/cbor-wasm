/**
 * Concatenate Uint8Array's.
 * @param {Array<Uint8Array>} arrays - the arrays to concat
 * @returns {Uint8Array} concatenated
 */
export function concat(arrays: Array<Uint8Array>): Uint8Array;
/**
 * Convert to a hex string
 * @param {Uint8Array} buf - bytes
 * @returns {string} hex
 */
export function toHex(buf: Uint8Array): string;
/**
 * Convert from a hex string
 * @param {string} str - hex
 * @returns {Uint8Array} bytes
 */
export function fromHex(str: string): Uint8Array;
/**
 * Load a WASM library, relative to this file.
 * {@linkcode WasmLib#init WasmLib.init} MUST be called.
 */
export class WasmLib {
    /**
     * @param {string} fileName - name of the WASM file, relative to this one
     */
    constructor(fileName: string);
    fileName: string;
    /** @type {WebAssembly.Module?} */
    compiled: WebAssembly.Module | null;
    /**
     * Instantiate the library.  The first time this is called for a given
     * library, the library will be fetched and compiled before instantiation.
     * @param {object} [env={}] - the environment to be passed to the library.
     * @returns {Promise<object>} the exports of the library instance, with C
     *   globals converted to their values.
     */
    init(env?: object): Promise<object>;
}
export type FetchArrayBuffer = () => Promise<Buffer | ArrayBuffer>;
export type FetchResult = {
    arrayBuffer: FetchArrayBuffer;
};
