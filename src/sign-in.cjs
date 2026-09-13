const { navigationAllowed, channelURL } = require('./model.cjs');
function isSignInURL(url) {
  return navigationAllowed(url) && /^\/(?:login|register)(?:\/|$)/.test(new URL(url).pathname);
}
// Only the dedicated account window confirms sign-in. Channel panes keep their
// assignments and wait; already-open peers are never included in the reload set.
class SignIn {
  constructor() { this.status='unknown';this.open=false;this.waiting=new Set(); }
  begin() { this.open=true; }
  end() { this.open=false; }
  require(index) { this.status='required';this.waiting.add(index); }
  defer(index) {
    if(this.status!=='required'&&!this.open)return false;
    this.waiting.add(index);return true;
  }
  observeAccount(url) {
    if(!this.open)return {signedIn:false,resume:[]};
    if(isSignInURL(url))this.status='required';
    else if(channelURL(url)) {
      const resume=[...this.waiting];
      this.status='connected';this.open=false;this.waiting.clear();
      return {signedIn:true,resume};
    }
    return {signedIn:false,resume:[]};
  }
  remove(index) { this.waiting.delete(index); }
}
module.exports={SignIn,isSignInURL};
