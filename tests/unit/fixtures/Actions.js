class Actions {
  async doStuff() {
    const { value } = this.state;
    const result = await Promise.resolve(value / 2);

    return { result };
  }
}

module.exports = Actions;
