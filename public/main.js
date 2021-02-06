//Global variables
let lines, lines2, pictureNum, picUrl, socket, THREAD_TEMPLATE_PIC, OP_PIC_TEMPLATE, MESSAGE_PIC_TEMPLATE;
let thread = "0";
let messages = [];
let threads = [];
let retries = -1;

//DOM elements 
const boardDom = document.getElementById('currBoard');
const threadListElement = document.getElementById('posts-container');
const messageListElement = document.getElementById('test-container');
const fileSubmission = document.getElementById('fileSubmission');

//temples with no user uploaded pictures
THREAD_TEMPLATE = `
<div class="post center">
<div class="post-title">
</div>
<div class="post-text"></div>
<br>
</div>
`
MESSAGE_TEMPLATE = `
<div class="message>
<div style="float:left;">
<div class="flex start">
<div class="message-title">
</div>
<div class="message-number">
</div>
</div>
<div class="message-text"></div>
</div>
<br>
</div>
`

//Make templates with user uploaded pictures
makeThreadTemlate = (picUrl) => {
    THREAD_TEMPLATE_PIC = `
        <div class="post center">
        <div class="post-picture">
        <img src="${picUrl}" height="100%" width="100%" />
        </div>
        <div class="post-title">
        </div>

        <div class="post-text center"></div>
        <br>

		</div>
`
}

makeOPTemplate = (picUrl) => {
    OP_PIC_TEMPLATE = `
<div class="OP">
        <img class="op-picture" id="op-id-picture" src="${picUrl}" onClick="zoomImg()" />
<div style="margin-left:10px;">
<div class="flex start">
<div class="OP-subj">
</div>
        <div class="OP-title">	
</div>
<div class="OP-number">
</div>
</div>
        <div class="OP-text"></div>
</div>
</div>	
`
}

makeMessageTemplate = (picUrl, num) => {
    pictureNum = `picture-${num}`;
    MESSAGE_PIC_TEMPLATE = `
        <div class="message">
        <img class="op-picture" id="${pictureNum}" src="${picUrl}" onClick="zoomImg2(pictureNum)"  />
       <div style="float:left;">
<div class="flex start">
        <div class="message-title">
        </div>
        <div class="message-number">
        </div>
</div>
        <div class="message-text"></div>
</div>
        <br>
		</div>
`
}

//Board setter
boardSet = (board) => {
    if (retries > 0) {
        boardDom.innerHTML = `<p>Connecting/Reconnecting... (${retries})</p>`
    } else {
        boardDom.innerHTML = `<p>Connecting/Reconnecting...</p>`
    }
}

setUsers = (num) => {

    if (num > 0) {
        boardDom.innerHTML = `Users online: ${num}`;
    }

}

init = () => {
    retries = retries + 1;
    socket = new WebSocket("wss://" + location.host);

    // Log errors to the console for debugging.
    socket.onerror = function (error) {
        console.log(error);
    };

    // Reconnect upon disconnect.
    socket.onclose = function () {
        console.log(`Your socket has been disconnected. Attempting to reconnect...`);
        setTimeout(function () {
            init();
        }, 1000);
    };

    socket.onmessage = function (message) {
        parsedData = JSON.parse(message.data);
        if (parsedData.alert) {
            alert(parsedData.alert);
        } else if (parsedData.command && !parsedData.argument) {
            exec = parsedData.command;
            if (exec in cmd) {
                cmd[exec]();
            }
        } else if (parsedData.command && parsedData.argument) {
            exec = parsedData.command;
            arg = parsedData.argument;
            if (exec in cmd) {
                cmd[exec](arg);
            }
        } else {
            console.log(`Woops! ${parsedData}`);
        }
    };

    socket.onopen = function () {
        retries = -1;
        console.log('client connected successfully');
        if (thread == 0) {
            cmd.getThreads(0);
        } else {
            cmd.getMessages(0, thread);

        }
    };
}

displayMessages = (snap) => {
    thread = snap[0].threadID;
    messageListElement.innerHTML = "";
    threadListElement.innerHTML = "";
    document.getElementById('messageBtn').classList.remove('hidden');
    document.getElementById('threadBtn').classList.add('hidden');
    document.getElementById('return').innerHTML = `Back`;
    let msgKey, i, x;
    if (snap.length < 500) {
        x = snap.length;
    } else {
        x = 500;
    }
    for (i = 0; i < x; i++) {
        msgKey = document.getElementById(snap[i]._id);
        if (snap[i].pic) {
            picUrl = snap[i].pic;
            makeOPTemplate(picUrl);
            makeMessageTemplate(picUrl, i);
            if (!msgKey && snap[i].board == 0 && i == 0) {
                container = document.createElement('div');
                container.innerHTML = OP_PIC_TEMPLATE;
                container.setAttribute('id', snap[i]._id);
                messageListElement.appendChild(container);
                if (snap[i].title) {
                    container.querySelector('.OP-title').textContent = `${snap[i].nick}`;
                    container.querySelector('.OP-subj').textContent = `${snap[i].title}`;
                } else {
                    container.querySelector('.OP-title').textContent = `${snap[i].nick}`;
                }
                container.querySelector('.OP-number').textContent = `>>${snap[i].postID}`;
                messageElement = container.querySelector('.OP-text');
                messageElement.textContent = snap[i].message;
                greenText(messageElement.innerHTML);
                messageElement.innerHTML = lines;
                messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
            }
            if (!msgKey && snap[i].board == 0 && i > 0) {
                container = document.createElement('div');
                container.innerHTML = MESSAGE_PIC_TEMPLATE;
                container.setAttribute('id', snap[i]._id);
                messageListElement.appendChild(container);
                container.querySelector('.message-title').textContent = snap[i].nick;
                container.querySelector('.message-number').textContent = `>>${snap[i].postID}`;
                messageElement = container.querySelector('.message-text');
                messageElement.textContent = snap[i].message;
                greenText(messageElement.innerHTML);
                messageElement.innerHTML = lines;
                messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
            }
        } else if (!snap[i].pic) {
            if (!msgKey && snap[i].board == 0 && i > 0) {
                container = document.createElement('div');
                container.innerHTML = MESSAGE_TEMPLATE;
                container.setAttribute('id', snap[i]._id);
                messageListElement.appendChild(container);
                container.querySelector('.message-title').textContent = snap[i].nick;
                container.querySelector('.message-number').textContent = `>>${snap[i].postID}`;
                messageElement = container.querySelector('.message-text');
                messageElement.textContent = snap[i].message;
                greenText(messageElement.innerHTML);
                messageElement.innerHTML = lines;
                messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
            }
        }
    }
};

displayThreads = (snap) => {
    threadListElement.innerHTML = "";
    messageListElement.innerHTML = "";
    thread = 0;
    document.getElementById('threadBtn').classList.remove('hidden');
    document.getElementById('messageBtn').classList.add('hidden');
    document.getElementById('return').innerHTML = `Refresh`;
    let msgKey;
    let i, x;
    if (snap.length - 1 >= 50) {
        x = 50;
    } else {
        x = snap.length;
    }
    for (i = 0; i < x; i++) {
        msgKey = document.getElementById(snap[i]._id);
        if (!msgKey && snap[i].board == 0) {
            if (snap[i].pic) {
                picUrl = snap[i].pic;
                makeThreadTemlate(picUrl);
                container = document.createElement('div');
                container.innerHTML = THREAD_TEMPLATE_PIC;
                container.setAttribute('id', snap[i].threadID);
                container.setAttribute('onClick', `cmd.getMessages(0, this.getAttribute('id'))`);
                threadListElement.appendChild(container);
                container.querySelector('.post-title').textContent = snap[i].title;
                messageElement = container.querySelector('.post-text');
                messageElement.textContent = snap[i].message;
                greenText(messageElement.innerHTML);
                messageElement.innerHTML = lines;
                messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
            } else {
                container = document.createElement('div');
                container.innerHTML = THREAD_TEMPLATE;
                container.setAttribute('id', snap[i].threadID);
                container.setAttribute('onClick', `cmd.getMessages(0, this.getAttribute('id'))`);
                threadListElement.appendChild(container);
                container.querySelector('.post-title').textContent = snap[i].title;
                messageElement = container.querySelector('.post-text');
                messageElement.textContent = snap[i].message;
                greenText(messageElement.innerHTML);
                messageElement.innerHTML = lines;
                messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
            }
        }
    }
}

const cmd = {

    getThreads: (board) => {
        socket.send([`getThreads`, board]);
    },

    getMessages: (board, threadID) => {
        socket.send([`getMessages`, board, threadID]);
    },

    displayThreads: (msg) => {
        threads = msg;
        displayThreads(threads);
        thread = 0;
        document.getElementById('return').innerHTML = `Refresh`;

    },

    displayThread: (msg) => {
        for (i = threads.length - 1; i >= 0; i--) {
            if (threads[i]._id === msg._id) {
                threads.remove(i);
            }
        }
        threads.unshift(msg);
        displayThreads(threads);
    },

    displayMessage: (msg) => {
        messages.push(msg);
        displayMessages(messages);
    },

    displayMessages: (msg) => {
        messages = msg;
        displayMessages(msg);
    },

    getUsers: (num) => {
        setUsers(num);
    }

}

Array.prototype.remove = function (from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};

emitThread = (board, subj, message) => {
    subj = document.getElementById('threadSubj').value;
    nick = document.getElementById('threadName').value;
    message = document.getElementById('threadMessage').value;
    socket.send(['submitThread', board, subj, nick, message]);
    clearInput1();
    threadFrm();
}

emitPost = (board, thread) => {
    message = document.getElementById('messageVal').value;
    nick = document.getElementById('messageName').value;
    socket.send(['submitMessage', board, thread, nick, message]);
    clearInput2();
    scrollDown();
    messageFrm();
}

clearInput = () => {
    document.getElementById('postMessage').value = "";
}

scrollDown = () => {
    window.scrollTo(0, document.body.scrollHeight);
}

threadFrm = () => {
    document.getElementById('threadSubmit').classList.toggle('hidden');
    document.getElementById('return').classList.toggle('hidden');
    document.getElementById('form-id').classList.toggle('hidden');
}

messageFrm = () => {
    document.getElementById('messageSubmit').classList.toggle('hidden');
    document.getElementById('return').classList.toggle('hidden');
    document.getElementById('form-id').classList.toggle('hidden');
}

clearInput1 = () => {
    let threadSubj = document.getElementById('threadSubj');
    let threadName = document.getElementById('threadName');
    let threadMessage = document.getElementById('threadMessage');
    if (threadSubj.value) {
        threadSubj.value = ""
    };
    if (threadName.value) {
        threadName.value = ""
    };
    if (threadMessage.value) {
        threadMessage.value = ""
    };
}

clearInput2 = () => {
    let messageName = document.getElementById('messageName');
    let messageVal = document.getElementById('messageVal');
    if (messageName.value) {
        messageName.value = ""
    };
    if (messageVal.value) {
        messageVal.value = ""
    };
}

zoomImg = () => {
    document.getElementById('op-id-picture').classList.toggle('op-picture');
    document.getElementById('op-id-picture').classList.toggle('zoom-img');
}

zoomImg2 = (messageElement) => {
    /* fix this
    document.getElementById(messageElement).classList.toggle('op-picture');
    document.getElementById(messageElement).classList.toggle('zoom-img');
    */
}

greenText = (message) => {
    lines = message.split('\n');
    lines2 = [];
    for (i = 0; i < lines.length; i++) {
        if (lines[i].match(/&gt.*/g) !== null) {
            lines[i] = `<div style="color:#8F9749; padding:0px; margin:0px;">${lines[i]}</div>_`
            lines2.push(lines[i]);
        } else {
            lines2.push(lines[i]);
        }
    }
    regex = /_/gi;
    lines = lines2.join('_');
    lines = lines.replace(regex, ' ');
}

init();