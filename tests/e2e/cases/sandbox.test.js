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

  await t
    .click(target.parent('details'))
    .click(target.find('button'))
    .expect(target.find('div').exists).ok()
    .expect(target.find('div button').nth(1).exists)
    .ok();

  await t
    .click(target.find('div button').nth(1))
    .expect(target.find('div h1').textContent).contains(1);

  await t
    .click(target.find('div button').nth(0))
    .click(target.find('div button').nth(0))
    .expect(target.find('div h1').textContent).contains(-1);

  await t
    .click(target.find('div button').nth(2))
    .expect(target.find('div').count).eql(0);
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
