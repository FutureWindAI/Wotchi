export class WotchiConfigurationError extends Error {
  constructor(message: string) {
    super(`Invalid Wotchi configuration: ${message}`);
    this.name = "WotchiConfigurationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
