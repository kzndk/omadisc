const {test}=require('node:test');
const assert=require('node:assert/strict');
const {SignIn,isSignInURL}=require('../src/sign-in.cjs');
const HOME='https://discord.com/channels/@me';
test('only official Discord sign-in routes trigger coordination',()=>{
  assert.equal(isSignInURL('https://discord.com/login?redirect_to=%2Fchannels%2F%40me'),true);
  for(const url of [HOME,'https://example.com/login','https://discord.com.evil.test/login','https://discord.com/login-fake'])assert.equal(isSignInURL(url),false);
});
test('account sign-in releases only waiting panes and rejects unrelated navigation',()=>{
  const login=new SignIn();assert.equal(login.defer(0),false);
  login.require(1);login.require(2);assert.equal(login.defer(3),true);
  assert.deepEqual(login.observeAccount(HOME),{signedIn:false,resume:[]});
  login.begin();
  for(const url of ['https://discord.com/login','https://discord.com/register','https://example.com/channels/@me','https://discord.com/channels/@me?token=no']) {
    assert.deepEqual(login.observeAccount(url),{signedIn:false,resume:[]});
  }
  assert.deepEqual(login.observeAccount(HOME),{signedIn:true,resume:[1,2,3]});
  assert.equal(login.status,'connected');assert.equal(login.defer(4),false);
  assert.deepEqual(login.observeAccount(HOME),{signedIn:false,resume:[]});
});
test('cancelling and clearing a pane do not bypass required account sign-in',()=>{
  const login=new SignIn();login.require(0);login.begin();login.defer(1);
  login.end();login.remove(0);
  assert.equal(login.status,'required');assert.equal(login.open,false);
  assert.equal(login.defer(2),true);
  login.begin();assert.deepEqual(login.observeAccount(HOME),{signedIn:true,resume:[1,2]});
});
test('opening account settings defers new panes while retaining existing sessions',()=>{
  const login=new SignIn();login.begin();assert.equal(login.defer(5),true);
  // Discord may redirect a saved login directly to channels without a login form.
  assert.deepEqual(login.observeAccount(HOME),{signedIn:true,resume:[5]});
  login.require(2);assert.equal(login.status,'required');
});
