const Actions = require('./Actions');

class Thunk extends Actions {
  constructor(props, children) {
    super(props, children);
    this.children = children;
    this.state = {
      value: props.value || 42,
      result: null,
    };
  }

  render() {
    return [[
      ['button', { onclick: this.doStuff }, this.children],
      ['span', ['Got: ', this.state.result || '?', ' (', this.state.value, ')']],
    ]];
  }
}

module.exports = Thunk;
