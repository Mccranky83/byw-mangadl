export default class {
  constructor() {
    this.locked = false;
    this.queue = [];
  }
  async lock() {
    return new Promise((res) => {
      if (this.locked) this.queue.push(res);
      else {
        this.locked = true;
        res();
      }
    });
  }
  unlock() {
    if (this.queue.length) this.queue.shift()();
    else this.locked = false;
  }
}
