const { test } = require('node:test');
const assert = require('node:assert/strict');
const { guildFromURL, normalizeChannelDirectory } = require('../src/channel-directory.cjs');

const guild='123456789012345678';
const channel=id=>`https://discord.com/channels/${guild}/${id}`;

test('channel directories stay within the active server and clean remote labels',()=>{
  const current=channel('234567890123456789');
  const result=normalizeChannelDirectory(current,{
    guild,server:'  Morpheus & Team  ',channels:[
      {url:current,label:'  kzn  '},
      {url:channel('234567890123456790'),label:'team   lounge'},
      {url:current,label:'duplicate'},
      {url:'https://discord.com/channels/999999999999999999/888888888888888888',label:'other server'},
      {url:channel('234567890123456791'),label:'bad\nlabel'},
      {url:'https://discord.com/channels/@me/234567890123456789',label:'dm'}
    ]
  });
  assert.deepEqual(result,{server:'Morpheus & Team',channels:[
    {url:current,label:'kzn'},
    {url:channel('234567890123456790'),label:'team lounge'},
    {url:channel('234567890123456791'),label:'Channel 234567890123456791'}
  ]});
});

test('channel directories are unavailable for home, DMs and mismatched data',()=>{
  assert.equal(guildFromURL(channel('234567890123456789')),guild);
  assert.equal(guildFromURL('https://discord.com/channels/@me'),null);
  assert.equal(guildFromURL('https://discord.com/channels/@me/234567890123456789'),null);
  assert.deepEqual(normalizeChannelDirectory('https://discord.com/channels/@me',{guild,channels:[]}),{server:'',channels:[]});
  assert.deepEqual(normalizeChannelDirectory(channel('234567890123456789'),{guild:'999999999999999999',channels:[]}),{server:'',channels:[]});
});
