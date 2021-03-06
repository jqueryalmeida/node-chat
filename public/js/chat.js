// Variables
var user,
    timer,
    socket,
    oldname,
    username,
    clients = [],
    nmr = 0,
    dev = false,
    unread = 0,
    focus = true,
    connected = false,
    version = 'BETA 0.15.21',
    blop = new Audio("sounds/blop.wav");

emojione.ascii = true;
emojione.imageType = 'png';
emojione.unicodeAlt = false;
document.getElementById('version').innerHTML = version;

var regex = /(&zwj;|&nbsp;)/g;

var ping = setInterval(function(){
    socket.send(JSON.stringify({type: 'ping'}));
}, 60 * 1000);

// Connection
var connect = function() {
    socket = new WebSocket('ws://localhost:3000/socket/websocket');

    socket.onopen = function() {
        console.info('Connection established.');
        updateInfo();
    };

    socket.onclose = function() {
        if(connected) {
            updateBar('mdi-action-autorenew spin', 'Connection lost, reconnecting...', true);

            timer = setTimeout(function() {
                console.warn('Connection lost, reconnecting...');
                connect();
            }, 1500);
        }
        clients = [];
    };

    socket.onmessage = function(e) {
        var data = JSON.parse(e.data);
        if(dev) console.log(data);

        if(data.type == 'server') {
            switch(data.info) {
                case 'rejected':
                    var message;
                    if(data.reason == 'length') message = 'Your username must have at least 3 characters and no more than 16 characters';
                    if(data.reason == 'format') message = 'Your username must only contain alphanumeric characters (numbers, letters and underscores)';
                    if(data.reason == 'taken') message = 'This username is already taken';
                    if(data.reason == 'banned') message = 'You have been banned from the server. You have to wait until you get unbanned to be able to connect again';
                    showChat('light', null, message);

                    if(!data.keep) {
                        username = undefined;
                        connected = false;
                    } else {
                        username = oldname;
                    }
                    break;

                case 'success':
                    document.getElementById("send").childNodes[0].nodeValue = "Send";
                    updateBar('mdi-content-send', 'Enter your message here', false);
                    connected = true;
                    break;

                case 'update':
                    showChat('info', null, data.user.oldun + ' changed its name to ' + data.user.un);
                    clients[data.user.id] = data.user;
                    break;

                case 'connection':
                    showChat('info', null, data.user.un + ' connected to the server');
                    clients[data.user.id] = data.user;
                    document.getElementById('users').innerHTML = Object.keys(clients).length + ' USERS';
                    break;

                case 'disconnection':
                    if(data.user.un != null)
                        showChat('info', null, data.user.un + ' disconnected from the server');
                    delete clients[data.user.id];
                    document.getElementById('users').innerHTML = Object.keys(clients).length + ' USERS';
                    break;

                case 'spam':
                    showChat('light', null, 'You have to wait 1 second between messages');
                    break;

                case 'clients':
                    clients = data.clients;
                    document.getElementById('users').innerHTML = Object.keys(clients).length + ' USERS';
                    break;

                case 'delete':
                    $('div[data-mid="' + data.mid + '"]').remove();
                    break;

                case 'user':
                    user = data.client.id;
                    break;
            }
        } else if((data.type == 'kick' || data.type == 'ban') && data.extra == username) {
            location.reload()
        } else {
            if(data.message.indexOf('@' + username) > -1)
                data.type = 'mention';

            showChat(data.type, data.user, data.message, data.subtxt, data.mid);
        }

        if((data.type == 'op' || data.type == 'deop')) {
            if(data.type == 'op') {
                if(data.extra == username) $('#admin').show();
                clients[getUserByName(data.extra).id].op = true;
            }
            if(data.type == 'deop') {
                if(data.extra == username) $('#admin').hide();
                clients[getUserByName(data.extra).id].op = false;
            }
        }

        if(data.type == 'global' || data.type == 'pm' || data.type == 'mention') {
            if(!focus) {
                unread++;
                document.title = '(' + unread + ') Node.JS Chat';
                if(document.getElementById('sound').checked)
                    blop.play();
            }
        }
    }
};

function sendSocket(value, method, other, txt) {
    socket.send(JSON.stringify({
        type: method,
        message: value,
        subtxt: txt,
        extra: other
    }));
}

function updateInfo() {
    socket.send(JSON.stringify({
        user: username,
        type: 'update'
    }));
}


// Utilities
function getUserByName(name) {
    for(client in clients)
        if(clients[client].un == name)
            return clients[client];
}

function updateBar(icon, placeholder, disable) {
    document.getElementById('icon').className = 'mdi ' + icon;
    $('#message').attr('placeholder', placeholder);
    $('#message').prop('disabled', disable);
    $('#send').prop('disabled', disable);
}

function showChat(type, user, message, subtxt, mid) {
    if(type == 'global' || type == 'kick' || type == 'ban' || type == 'info' || type == 'light' || type == 'help' || type == 'op' || type == 'deop') user = 'System';
    if(type == 'me' || type == 'em') type = 'emote';
    if(!mid) mid == 'system';

    if(!subtxt)
        $('#panel').append('<div data-mid="' + mid + '" class="' + type + '""><span class="name"><b><a href="javascript:void(0)">' + user + '</a></b></span><span class="delete"><a href="javascript:void(0)">DELETE</a></span><span class="timestamp">' + getTime() + '</span><span class="msg">' + message + '</span></div>');
    else
        $('#panel').append('<div  data-mid="' + mid + '" class="' + type + '""><span class="name"><b><a href="javascript:void(0)">' + user + '</a></b></span><span class="timestamp">(' + subtxt + ') ' + getTime() + '</span><span class="msg">' + message + '</span></div>');
    
    $('#panel').animate({scrollTop: $('#panel').prop("scrollHeight")}, 500);
    updateStyle();
    nmr++;
}

function handleInput() {
    var value = $('#message').val().replace(regex, ' ').trim();

    if(value.length > 0) {
        if(username === undefined) {
            username = value;
            connect();
        } else if(value.charAt(0) == '/') {
            var command = value.substring(1).split(' ');

            switch(command[0].toLowerCase()) {
                case 'pm': case 'op': case 'deop': case 'kick': case 'ban': case 'name': case 'alert': case 'me': case 'em':
                    if(value.substring(command[0].length).length > 1) {
                        if(command[0] == 'pm' && value.substring(command[0].concat(command[1]).length).length > 2)
                            sendSocket(value.substring(command[0].concat(command[1]).length + 2), 'pm', command[1], 'PM');
                        else if(command[0] == 'pm')
                            showChat('light', 'Error', 'Use /pm [user] [message]');

                        if(command[0] == 'ban' && value.substring(command[0].concat(command[1]).length).length > 2)
                            sendSocket(command[1], 'ban', command[2]);
                        else if(command[0] == 'ban')
                            showChat('light', 'Error', 'Use /ban [user] [message]');

                        if(command[0] == 'alert')
                            sendSocket(value.substring(command[0].length + 2), 'global', null, username);

                        if(command[0] == 'op' || command[0] == 'deop' || command[0] == 'kick' || command[0] == 'me' || command[0] == 'em')
                            sendSocket(value.substring(command[0].length + 2), command[0]);

                        if(command[0] == 'name') {
                            oldname = username;
                            username = value.substring(command[0].length + 2);
                            updateInfo();
                        }
                    } else {
                        var variables;
                        if(command[0] == 'alert' || command[0] == 'me' || command[0] == 'em')
                            variables = ' [message]';
                        if(command[0] == 'kick' || command[0] == 'op' || command[0] == 'deop')
                            variables = ' [user]';
                        if(command[0] == 'ban')
                            variables = ' [user] [minutes]';
                        if(command[0] == 'pm')
                            variables = ' [user] [message]';
                        if(command[0] == 'name')
                            variables = ' [name]';

                        showChat('light', 'Error', 'Use /' + command[0] + variables);
                    }
                    break; 

                case 'clear':
                    nmr = 0;
                    document.getElementById('panel').innerHTML = '';
                    showChat('light', 'System', 'Messages cleared');
                    break;

                case 'shrug':
                    sendSocket(value.substring(6) + ' ¯\\_(ツ)_/¯', 'message');
                    break;

                case 'help':
                    $('#help-dialog').modal('show');
                    $('#message').val('');
                    break;

                case 'reconnect':
                    socket.close();
                    break;

                default:
                    showChat('light', 'Error', 'Unknown command, use /help to get a list of the available commands');
                    break;
            }
        } else {
            sendSocket(value, 'message');
        }

        $('#message').val('');
    }
}

function getTime() {
    var now = new Date(),
        time = [now.getHours(), now.getMinutes(), now.getSeconds()];
 
    for(var i = 0; i < 3; i++) {
        if(time[i] < 10)
            time[i] = "0" + time[i];
    }
 
    return time.join(":");
}

function updateStyle() {
    $('#panel').linkify();
    var element = document.getElementsByClassName('msg')[nmr];

    if(document.getElementById('greentext').checked && element.innerHTML.indexOf('&gt;') == 0)
        element.style.color = '#689f38';

    if(document.getElementById('emoji').checked) {
        var input = element.innerHTML;
        var output = emojione.shortnameToImage(element.innerHTML);
        element.innerHTML = output;
    }
}


// Triggers
$(document).ready(function() {
    $('#user').bind("click", function() {
        var content = '',
            admin;

        for(var i in clients) {
            if(clients[i] != undefined) {
                clients[i].op ? admin = ' - <b>Administrator</b></li>' : admin = '</li>';
                content += '<li><b>ID:</b> ' + clients[i].id + ' - <b>Name:</b> ' + clients[i].un + admin;
            }
        }

        document.getElementById('users-content').innerHTML = content;
        $('#users-dialog').modal('show');
    });

    $('#panel').on('mouseenter', '.message', function() {
        if(clients[user].op) {
            $(this).find('span:eq(1)').show();
            $(this).find('span:eq(2)').hide();
        }
    });

    $('#panel').on('mouseleave', '.message',function() {
        if(clients[user].op) {
            $(this).find('span:eq(1)').hide();
            $(this).find('span:eq(2)').show();
        }
    });

    $('#panel').on('mouseenter', '.emote', function() {
        if(clients[user].op) {
            $(this).find('span:eq(1)').show();
            $(this).find('span:eq(2)').hide();
        }
    });

    $('#panel').on('mouseleave', '.emote', function() {
        if(clients[user].op) {
            $(this).find('span:eq(1)').hide();
            $(this).find('span:eq(2)').show();
        }
    });

    $('#panel').on('click', '.delete', function(e) {
        var value = $(this)[0].parentElement.attributes[0].value;
        sendSocket(value, 'delete');
    });

    $('#panel').on('click', '.name', function(e) {
        $('#message').val('@' + $(this)[0].children[0].children[0].innerHTML + ' ');
        $('#message').focus();
    });

    $('.message').bind('click', function(e) {
        console.log($(e.target)[0].parentNode.attributes[0].value);
    });

    $('#send').bind('click', function() {
        handleInput();
    });

    $('#admin').bind('click', function() {
        $('#admin-help-dialog').modal('show');
    });

    $('#help').bind('click', function() {
        $('#help-dialog').modal('show');
    });

    $("#message").keypress(function(e) {
        if(e.which == 13) {
            handleInput();
        }
    });
});

window.onfocus = function() {
    document.title = "Node.JS Chat";
    focus = true;
    unread = 0;
};

window.onblur = function() {
    focus = false;
};
