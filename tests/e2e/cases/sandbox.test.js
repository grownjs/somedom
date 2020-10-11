import { Selector } from 'testcafe';

/* global fixture, test */

fixture('somedom')
  .page(process.env.BASE_URL);

test('it loads', async t => {
  const error = Selector('.error');

  await t
    .expect(error.exists).ok()
    .expect(error.count).eql(1);
});

test('counter widget', async t => {
  const target = Selector('#target');
  const addCounter = target.find('button').withText('Add counter');

  await t
    .click(target.parent('details'))
    .click(addCounter)
    .click(addCounter)
    .click(addCounter)
    .click(target.find('div:nth-child(2) button').withText('-'))
    .click(target.find('div:nth-child(4) button').withText('+'))
    .expect(target.find(' div:nth-child(2) h1').textContent)
    .eql('-1')
    .expect(target.find(' div:nth-child(3) h1').textContent)
    .eql('0')
    .expect(target.find(' div:nth-child(4) h1').textContent)
    .eql('1');
});

test('lifecyle-hooks', async t => {
  const test5 = Selector('#test5');
  const info = Selector('#info');

  await t
    .click(test5.parent('details'))
    .expect(info.textContent)
    .contains('Created')
    .click(test5.find('button'))
    .expect(info.textContent)
    .contains('Updated')
    .click(test5.find('button'))
    .expect(info.textContent)
    .contains('Destroyed');
});

test('classes during lifecyle-hooks', async t => {
  const test4 = Selector('#test4');

  await t
    .click(test4.parent('details'))
    .click(test4.find('li button'))
    .expect(test4.find('li.animated.fadeIn').exists)
    .ok()
    .click(test4.find('li').nth(1).find('button'))
    .expect(test4.find('li.animated.slideUp').exists)
    .ok();
});

test('views and thunks health-checks', async t => {
  const target2 = Selector('#target2');
  const target3 = Selector('#target3');

  await t
    .click(target2.parent('details'))
    .expect(target2.find('h1').textContent).contains('It works?');

  await t
    .click(target3.find('button'))
    .expect(target3.find('span').textContent).contains('Value:');

  const output = Selector('#output');

  await t
    .click(output.parent('details'))
    .click(output.find('button').withText('++'))
    .expect(target3.find('span').textContent).contains('Value:');
});
