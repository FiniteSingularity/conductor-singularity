declare module "fast-mersenne-twister" {
  class MersenneTwister {
    constructor(seed?: number);
    randomNumber(): number;
    random31Bit(): number;
    randomInclusive(): number;
    random(): number;
    randomExclusive(): number;
    random53Bit(): number;
  }
}
