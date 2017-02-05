/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'armored_pubkey', 'parent_tab_id', 'minimized', 'frame_id']);
url_params.minimized = Boolean(Number(url_params.minimized || ''));

var pubkey = openpgp.key.readArmored(url_params.armored_pubkey).keys[0];

render();

function send_resize_message() {
  tool.browser.message.send(url_params.parent_tab_id, 'set_css', {
    selector: 'iframe#' + url_params.frame_id,
    css: { height: $('#pgp_block').height() + 30 }
  });
}

function set_button_text(db) {
  db_contact_get(db, $('.input_email').val(), function (contact) {
    $('.action_add_contact').text(contact && contact.has_pgp ? 'update contact' : 'add to contacts');
  });
}

function render() {
  $('.pubkey').text(url_params.armored_pubkey);
  $('.line.fingerprints, .line.add_contact').css('display', url_params.minimized ? 'none' : 'block');
  $('.line.fingerprints .fingerprint').text(tool.crypto.key.fingerprint(pubkey));
  $('.line.fingerprints .keywords').text(mnemonic(tool.crypto.key.longid(pubkey)));
}

db_open(function (db) {

  if(db === db_denied) {
    notify_about_storage_access_error(url_params.account_email, url_params.parent_tab_id);
    return;
  }

  if(typeof pubkey !== 'undefined') {
    $('.input_email').val(tool.str.trim_lower(pubkey.users[0].userId.userid));
    $('.email').text(tool.str.trim_lower(pubkey.users[0].userId.userid));
    set_button_text(db);
  } else {
    var unquoted = url_params.armored_pubkey;
    while(/\n> |\n>\n/.test(unquoted)) {
      unquoted = unquoted.replace(/\n> /g, '\n').replace(/\n>\n/g, '\n\n');
    }
    if(unquoted !== url_params.armored_pubkey) { // try to re-render it after un-quoting, (minimized because it is probably their own pubkey quoted by the other guy)
      window.location = 'pgp_pubkey.htm?account_email' + encodeURIComponent(url_params.account_email)
        + '&armored_pubkey=' + encodeURIComponent(unquoted)
        + '&parent_tab_id=' + encodeURIComponent(url_params.parent_tab_id)
        + '&frame_id=' + encodeURIComponent(url_params.frame_id)
        + '&minimized=1';
    } else {
      $('.line.add_contact').addClass('bad').html('This public key is invalid or has unknown format.');
      $('.line.fingerprints').css({ display: 'none', visibility: 'hidden' });
    }
    send_resize_message();
  }

  $('.action_add_contact').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
    if(tool.str.is_email_valid($('.input_email').val())) {
      db_contact_save(db, db_contact_object($('.input_email').val(), null, 'pgp', pubkey.armor(), null, false, Date.now()), function () {
        $(self).replaceWith('<span class="good">' + $('.input_email').val() + ' added</span>')
        $('.input_email').remove();
      });
    } else {
      alert('This email is invalid, please check for typos. Not added.');
      $('.input_email').focus();
    }
  }));

  $('.input_email').keyup(function () {
    set_button_text(db);
  });

});

$('.action_show_full').click(function () {
  $(this).css('display', 'none');
  $('pre.pubkey, .line.fingerprints, .line.add_contact').css('display', 'block');
  send_resize_message();
});

send_resize_message();
