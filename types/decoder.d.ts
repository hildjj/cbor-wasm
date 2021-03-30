/**
 * Unknown simple value
 * @property {number} val - the simple value
 */
export class Simple {
    /**
     * @param {BigInt} val - the simple value
     */
    constructor(val: BigInt);
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
     */
    static decode(tag: any, val: any): bigint | Tag;
    /**
     * @param {number} tag - the tag number
     * @param {any} val - the value inside the tag
     */
    constructor(tag: number, val: any);
    tag: number;
    val: any;
}
/**
 * Decode events from the WASM library into JS objects
 */
export class Decoder extends Parser {
    stack: any[];
}
import { Parser } from "./parser.js";
