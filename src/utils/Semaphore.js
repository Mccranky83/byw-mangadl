export default class {
  constructor(max_par) {
    this.counter = max_par;
    this.waitlist = [];
    this.paused = false;
    this.pauseRes = [];
    this.terminated = false;
  }
  async acquire() {
    await this.check();
    if (this.counter > 0) this.counter--;
    else
      await new Promise((res) => {
        this.waitlist.push(res);
      });
  }
  async release() {
    await this.check();
    if (this.waitlist.length > 0) {
      this.counter--;
      this.waitlist.shift()();
    }
    this.counter++;
  }
  async check() {
    this.paused &&
      (await new Promise((res) => {
        this.pauseRes.push(res);
      }));
  }
  togglePause() {
    this.paused = !this.paused;
    !this.paused && this.pauseRes.forEach((cur) => cur());
  }
  terminate() {
    this.terminated = true;
    // Requests sent must all resolve before continuing
    if (this.paused) this.togglePause();
    this.waitlist.forEach((cur) => {
      cur();
    });
  }
}
