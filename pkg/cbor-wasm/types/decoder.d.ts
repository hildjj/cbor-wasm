/**
 * Unknown simple value
 * @property {number} val - the simple value
 */
export class Simple {
    /**
     * @param {bigint} val - the simple value
     */
    constructor(val: bigint);
    val: number;
}
/**
 * Unknown tag
 * @property {number} tag - the tag number
 * @property {any} val - the value inside the tag
 */
export class Tag {
    /**
     * Decode known tags, or return an instance of {@linkcode Tag}
     * @param {bigint} tag - tag number
     * @param {any} val - the value
     * @returns {Tag|any} a Tag if the tag number is unknown, otherwise a coerced
     *   value
     */
    static decode(tag: bigint, val: any): Tag | any;
    /**
     * @param {bigint} tag - the tag number
     * @param {any} val - the value inside the tag
     */
    constructor(tag: bigint, val: any);
    tag: bigint;
    val: any;
}
/**
 * Decode events from the WASM library into JS objects
 */
export class Decoder extends Parser {
    /**
     * @callback DecoderFunction
     * @param {string|Uint8Array} input - The input to parse.  Should be a single
     *   complete CBOR item.
     * @returns {any} the decoded item
     * @throws {Error} on decoding errors, input too short
     */
    /**
     * Convenience function for decoding single complete CBOR inputs.  You still
     * have to await this function for WASM setup, but the function it returns
     * is synchronous.
     * @returns {Promise<DecoderFunction>}
     */
    static decoder(): Promise<DecoderFunction>;
    stack: any[];
}
export type DecoderFunction = (input: string | Uint8Array) => any;
import { Parser } from "./parser.js";
