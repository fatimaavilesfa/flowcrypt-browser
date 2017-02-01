/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'draft_id', 'placement', 'frame_id']);

db_open(function (db) {

  if(db === db_denied) {
    notify_about_storage_access_error(url_params.account_email, url_params.parent_tab_id);
    setTimeout(new_message_close, 300);
    return;
  }

  var attach = init_shared_attach_js();
  var compose = init_shared_compose_js(url_params, db, attach);

  function send_btn_click() {
    var recipients = compose.get_recipients_from_dom();
    var headers = { To: recipients.join(', '), Subject: $('#input_subject').val(), From: compose.get_sender_from_dom(), };
    compose.encrypt_and_send(url_params.account_email, recipients, headers.Subject, $('#input_text').get(0).innerText, function (encrypted_message_body, attachments, attach_files) {
      tool.mime.encode(url_params.account_email, encrypted_message_body, headers, attach_files ? attachments : null, function (mime_message) {
        tool.api.gmail.message_send(url_params.account_email, mime_message, null, function (success, response) {
          if(success) {
            tool.browser.message.send(url_params.parent_tab_id, 'notification_show', {
              notification: 'Your message has been sent.'
            });
            compose.draft_delete(url_params.account_email, tool.env.increment('compose', new_message_close));
          } else {
            compose.handle_send_message_error(response);
          }
        });
      });
    });
  }

  function order_addresses(account_email, addresses) {
    return [account_email].concat(tool.arr.without_value(addresses, account_email)); //places main account email as first
  }

  if(url_params.placement === 'popup') {
    $('body').addClass('popup');
  }

  $('.delete_draft').click(function () {
    compose.draft_delete(url_params.account_email, new_message_close);
  });

  if(url_params.draft_id) {
    // todo - this is mostly copy/pasted from reply_message, would deserve a common function
    tool.api.gmail.draft_get(url_params.account_email, url_params.draft_id, 'raw', function (success, response) {
      if(success) {
        compose.draft_set_id(url_params.draft_id);
        tool.mime.decode(tool.str.base64url_decode(response.message.raw), function (mime_success, parsed_message) {
          if(success) {
            var draft_headers = tool.mime.headers_to_from(parsed_message);
            if((parsed_message.text || tool.crypto.armor.strip(parsed_message.html) || '').indexOf('-----END PGP MESSAGE-----') !== -1) {
              var stripped_text = parsed_message.text || tool.crypto.armor.strip(parsed_message.html);
              $('#input_subject').val(parsed_message.headers.subject || '');
              compose.decrypt_and_render_draft(url_params.account_email, stripped_text.substr(stripped_text.indexOf('-----BEGIN PGP MESSAGE-----')), undefined, draft_headers);
            } else {
              console.log('tool.api.gmail.draft_get tool.mime.decode else {}');
            }
          } else {
            console.log('tool.api.gmail.draft_get tool.mime.decode success===false');
            console.log(parsed_message);
          }
        });
      } else {
        console.log('tool.api.gmail.draft_get success===false');
        console.log(response);
      }
    });
  }

  compose.on_render();
  $('#send_btn').click(tool.ui.event.prevent(tool.ui.event.double(), send_btn_click));
  $('.close_new_message').click(new_message_close);
  account_storage_get(url_params.account_email, ['addresses'], function (storage) { // add send-from addresses
    if(typeof storage.addresses !== 'undefined' && storage.addresses.length > 1) {
      var addresses = order_addresses(url_params.account_email, storage.addresses);
      $('#input_addresses_container').addClass('show_send_from').append('<select id="input_from" tabindex="-1"></select>');
      $('#input_from').change(compose.rerender_include_pubkey_icon);
      $.each(addresses, function (i, address) {
        $('#input_from').append('<option value="' + address + '">' + address + '</option>');
      });
    }
  });

});

function new_message_close() {
  if(url_params.placement === 'settings') {
    tool.browser.message.send(url_params.parent_tab_id, 'close_page');
  } else if(url_params.placement === 'popup') {
    window.close();
  } else {
    tool.browser.message.send(url_params.parent_tab_id, 'close_new_message');
  }
}
