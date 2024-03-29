import { Selector } from 'testcafe';

/* global fixture, test */

fixture('somedom')
  .page(process.env.BASE_URL);

const error = Selector('.error');

test('it loads', async t => {
  await t
    .expect(error.exists).ok()
    .expect(error.count).eql(1);
});

test('element lifecycle-hooks', async t => {
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

test('element patching health-check', async t => {
  const test0 = Selector('#test0');
  const oldText = await test0.find('ul').textContent;

  await t
    .click(test0.parent('details'))
    .click(test0.parent().find('label').withText('Play')).wait(5000);

  await t
    .expect(error.exists).ok()
    .expect(error.count).eql(1);

  await t.expect(test0.find('ul').textContent).notEql(oldText);
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
