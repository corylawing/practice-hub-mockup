/* Home-Brace sign-in gate.
   Requires a real Microsoft sign-in before the page is usable.

   HONEST LIMIT: this hides the INTERFACE, not the FILES. Anything baked into the
   page source (today: the production figures in index.html) can still be fetched
   by anyone with the URL, gate or no gate. Only two things actually fix that:
   move the numbers out of the file and fetch them from Graph after sign-in, or
   host somewhere that refuses to serve files to anonymous users (Azure Static
   Web Apps with Entra auth). Both are planned; neither is done. */
(function(){
  'use strict';
  var CLIENT_ID = '2122a06f-b6e9-4618-9106-3b6d6a84b5eb';
  var TENANT_ID = 'edb81e45-7fa8-4147-982f-2f31c6298086';
  var SCOPES = ['User.Read'];
  /* The popup lands on a URI that must already be registered on the app.
     connect.html is registered, so reuse it rather than needing another round in Entra. */
  var REDIRECT = /localhost:8790/.test(location.origin)
    ? 'http://localhost:8790'
    : 'https://corylawing.github.io/practice-hub-mockup/v1/connect.html';

  var CSS =
    '#phgate{position:fixed;inset:0;z-index:99999;background:#0F2A4A;color:#fff;display:flex;' +
    'align-items:center;justify-content:center;padding:24px;' +
    'font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
    '#phgate .box{max-width:400px;width:100%;text-align:center}' +
    '#phgate img{width:56px;height:56px;border-radius:14px;margin-bottom:18px}' +
    '#phgate h1{font-size:23px;margin:0 0 7px;color:#fff;font-weight:700}' +
    '#phgate p{color:#9fb4d0;font-size:14px;margin:0 0 22px;line-height:1.5}' +
    '#phgate button{font-family:inherit;font-size:15px;font-weight:700;border:none;border-radius:11px;' +
    'padding:13px 24px;background:#149B96;color:#fff;cursor:pointer;width:100%}' +
    '#phgate button:hover{background:#0F827E}' +
    '#phgate button:disabled{opacity:.5;cursor:not-allowed}' +
    '#phgate .err{color:#FFC7BC;font-size:13px;margin-top:14px;min-height:18px}' +
    'body.phgated>*:not(#phgate){display:none !important}';

  function paint(){
    var st = document.createElement('style'); st.textContent = CSS;
    document.head.appendChild(st);
    var g = document.createElement('div');
    g.id = 'phgate';
    g.innerHTML =
      '<div class="box">' +
      '<img src="../assets/logo-mark.png" alt="">' +
      '<h1>Home-Brace</h1>' +
      '<p>This hub contains the practice’s production figures. Sign in with your work ' +
      'Microsoft account to continue.</p>' +
      '<button id="phgatebtn">Sign in with Microsoft</button>' +
      '<div class="err" id="phgateerr"></div></div>';
    document.body.appendChild(g);
    document.body.classList.add('phgated');
    return g;
  }

  function open(gate){
    gate.remove();
    document.body.classList.remove('phgated');
  }

  function start(){
    var gate = paint();
    var btn = document.getElementById('phgatebtn');
    var err = document.getElementById('phgateerr');
    function fail(m){ err.textContent = m; btn.disabled = false; }

    if (typeof msal === 'undefined'){
      fail('Could not load the Microsoft sign-in library. Check the connection and reload.');
      return;
    }
    var app = new msal.PublicClientApplication({
      auth: { clientId: CLIENT_ID,
              authority: 'https://login.microsoftonline.com/' + TENANT_ID,
              redirectUri: REDIRECT },
      cache: { cacheLocation: 'sessionStorage' }
    });
    app.initialize().then(function(){
      // Already signed in this session? Don't make them do it again on every page.
      if (app.getAllAccounts().length){ open(gate); return; }
      btn.onclick = function(){
        btn.disabled = true; err.textContent = '';
        app.loginPopup({ scopes: SCOPES }).then(function(){
          open(gate);
        }).catch(function(e){
          fail(e && e.errorCode === 'popup_window_error'
            ? 'The popup was blocked. Allow popups for this site, then try again.'
            : (e && (e.errorMessage || e.message)) || 'Sign-in failed.');
        });
      };
    }).catch(function(e){
      fail((e && (e.errorMessage || e.message)) || 'Sign-in could not start.');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
