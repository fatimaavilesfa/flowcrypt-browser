'use strict';

var url_params = get_url_params(['account_email', 'from', 'to', 'subject', 'frame_id', 'thread_id', 'parent_tab_id']);

var thread_message_id_last = '';
var thread_message_referrences_last = '';

$('div#reply_message_prompt, p#reply_links, a#a_reply, a#a_reply_all, a#a_forward').click(function() {
  $('div#reply_message_prompt').css('display', 'none');
  $('div#reply_message_table_container').css('display', 'block');
  reply_message_on_render();
  reply_message_determine_header_variables();
});

function reply_message_determine_header_variables() {
  gmail_api_get_thread(url_params['account_email'], url_params['thread_id'], 'full', function(success, thread) {
    if(success && thread.messages && thread.messages.length > 0) {
      thread_message_id_last = gmail_api_find_header(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
      thread_message_referrences_last = gmail_api_find_header(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
    }
  });
}

function reply_message_close() {
  chrome_message_send(url_params.parent_tab_id, 'close_reply_message', {
    frame_id: url_params['frame_id'],
    thread_id: url_params['thread_id']
  });
}

function reply_message_reinsert_reply_box() {
  chrome_message_send(url_params.parent_tab_id, 'reinsert_reply_box', {
    account_email: url_params['account_email'],
    last_message_frame_height: $('#reply_message_successful_container').height(),
    last_message_frame_id: url_params['frame_id'],
    my_email: url_params['from'],
    their_email: url_params['to'],
  });
}

function reply_message_render_success() {
  $('#reply_message_table_container').css('display', 'none');
  $('#reply_message_successful_container div.replied_from').text(url_params['from']);
  $('#reply_message_successful_container div.replied_to span').text(url_params['to']);
  $('#reply_message_successful_container div.replied_body').html($('#input_text').html());
  var t = new Date();
  var time = ((t.getHours() != 12) ? (t.getHours() % 12) : 12) + ':' + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
  $('#reply_message_successful_container div.replied_time').text(time);
  $('#reply_message_successful_container').css('display', 'block');
}

function reply_message_encrypt_and_send() {
  var headers = {
    'From': url_params['from'],
    'To': $('#input_to').val(),
    'Subject': url_params['subject'],
    'In-Reply-To': thread_message_id_last,
    'References': thread_message_referrences_last + ' ' + thread_message_id_last,
  };
  var plaintext = convert_html_tags_to_newlines($('#input_text').html());
  compose_encrypt_and_send(url_params['account_email'], headers['To'], headers['Subject'], plaintext, function(encrypted, message_text_to_send, attachments) {
    if(!encrypted) {
      // todo: good to show warning that they are replying to encrypted message in unencrypted way
      $('div.replied_body').removeClass('pgp_secure').addClass('pgp_insecure');
    }
    gmail_api_message_send(url_params['account_email'], message_text_to_send, headers, attachments, url_params['thread_id'], function(success, response) {
      if(success) {
        reply_message_render_success();
        reply_message_reinsert_reply_box();
      } else {
        alert('error sending message, check log');
      }
    });
  });
}

function reply_message_on_render() {
  $("#input_to").blur(compose_render_email_secure_or_insecure);
  $("#input_to").focus(compose_render_email_neutral);
  $('#send_btn').click(prevent(doubleclick(), reply_message_encrypt_and_send));
  $("#input_to").focus();
  $("#input_to").val(url_params['to']);
  document.getElementById("input_text").focus();
  initialize_attach_dialog();
}
