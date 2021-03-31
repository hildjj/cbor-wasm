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
    stack: any[];
}
import { Parser } from "./parser.js";
