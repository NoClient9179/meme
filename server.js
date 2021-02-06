// Initializer.
const express = require('express');
const app = express().enable('trust proxy');
const http = require('http');
const webServer = http.createServer(app);
const cors = require('cors');
const fileUpload = require('express-fileupload');
const Ddos = require('ddos')
const ddos = new Ddos({
    burst: 50,
    limit: 55
})
process.on('uncaughtException', function (err) { // don't kill the process if a library fails
    console.log("UNCAUGHT EXCEPTION\n" + err);
});

let collection, database;
let cloudflare = false;
throttledUsers = new Set();
throttledUsers2 = new Set();

// mongo
let mongodb = require('mongodb').MongoClient,
    assert = require('assert');

// Connection URL
const dbUrl = "mongodb://localhost";

// Use connect method to connect to the server
mongodb.connect(dbUrl, {
        auth: {
            user: '',
            password: ''
        },
        useNewUrlParser: true
    },
    function (err, client) {
        assert.equal(null, err);
        if (err) throw `MongoDB failed to initiate. ${err}`;
        database = client.db('admin');
        console.log(`MongoDB connected!`);
    });

// WebSockets
const webSocketServer = require('ws').Server;
const ws = new webSocketServer({
    server: webServer
});
const clients = new Map();

ws.on('connection', function connection(ws, req) {

    // get, store and verify client IP
    let clientIP;
    cloudflare ? clientIP = req.headers['cf-connecting-ip'] : clientIP = req.connection.remoteAddress
    console.log(`${clientIP} just connected.`);

    //set current board and thread to default
    let currBoard = 0;
    let threadID = 0;

    // set client states
    if (!clients.has(clientIP)) {
        clients.set(clientIP, {
            socket: ws,
            board: currBoard,
            threadID: threadID,
            IP: clientIP,
            upload: ``
        });

        // Sanity check
        console.log(`${clients.size} client(s) connected`);

        // Update user count on client side
        wsBroadcastBoard(JSON.stringify({
            command: 'getUsers',
            argument: clients.size
        }), 0);

    } else {
        // set client states
        clients.delete(clientIP);
        clients.set(clientIP, {
            socket: ws,
            board: currBoard,
            threadID: threadID,
            IP: clientIP,
            upload: ``
        });

        // Sanity check
        console.log(`${clients.size} client(s) connected`);

        // Update user count on client side
        wsBroadcastBoard(JSON.stringify({
            command: 'getUsers',
            argument: clients.size
        }), 0);


    }


    ws.on('close', function () {

        //remove client from currently connected users
        clients.delete(clientIP);

        //Sanity check
        console.log(`${clientIP} just disconnected.`);

        // Update user count on client side
        wsBroadcastBoard(JSON.stringify({
            command: 'getUsers',
            argument: clients.size
        }), 0);

    });

    ws.on('message', function incoming(message) {

        // prevent users the server isn't aware of from connecting
        if (!clientIP) {
            alertStr = 'Error.';
            wsAlert(clientIP, alertStr);
            return;
        }

        let post = [];
        let msg, title, nick;
        msg = message.split(",");

        //Sanity check
        console.log(`Got command ${msg[0]} from client ${clientIP}`);

        // submitting a reply
        if (msg[0] === 'submitMessage') {

            // Rate limit check
            if (throttledUsers.has(clientIP)) {
                alertStr = 'Rate limited.';
                wsAlert(clientIP, alertStr);
                return;
            }

            //Formulate contents of post
            for (i = 0; i < msg.length; i++) {
                if (i > 3) {
                    post.push(msg[i]);
                }
            }
            post = post.join();

            //let's be sure we're sending this data to the right place
            currBoard = msg[1];
            threadID = msg[2];
            nick = msg[3];

            //let's REALLY be sure we're sending this data to the right place
            console.log(currBoard, threadID, nick);

            // loose data types suck so let's just be safe
            if (parseInt(currBoard) > 0) {
                return;
            }

            // is this a valid command? if so, continue
            if (msg[0] in cmd && post.length > 0) {
                var funct = cmd[msg[0]];
                funct(clientIP, currBoard, threadID, nick, post);

            }
        }

        // submit a thread
        if (msg[0] === 'submitThread') {

            //rate limit check
            if (throttledUsers2.has(clientIP)) {
                alertStr = 'Rate limited.';
                wsAlert(clientIP, alertStr);
                return;
            }


            //Formulate contents of post
            for (i = 0; i < msg.length; i++) {
                if (i > 3) {
                    post.push(msg[i]);
                }
            }
            post = post.join();

            //let's be sure we're sending this data to the right place
            currBoard = msg[1];
            title = msg[2];
            nick = msg[3];
            threadID = 0;

            // Sanity check
            console.log(`Got command ${msg[0]} from client ${clientIP} who is on board ${currBoard}:${threadID}.`);

            // loose data types suck so let's just be safe
            if (parseInt(currBoard) > 0) {
                return;
            }

            // is this a valid command? if so, continue
            if (msg[0] in cmd && post.length > 0) {
                var funct = cmd[msg[0]];
                funct(clientIP, currBoard, title, nick, post);
            }
        }

        // get and display threads
        if (msg[0] === 'getThreads') {
            currBoard = msg[1];
            threadID = 0;
            clients.set(clientIP, {
                socket: ws,
                board: currBoard,
                threadID: threadID,
                IP: clientIP,
                upload: ``
            });

            // Sanity check
            console.log(`Got command ${msg[0]} from client ${clientIP} who is on board ${currBoard}:${threadID}.`);

            // loose data types suck so let's just be safe
            if (parseInt(currBoard) > 0) {
                return;
            }

            if (msg[0] in cmd) {
                var funct = cmd[msg[0]];
                funct(clientIP, currBoard);
            }
        }

        // get and display posts within a thread
        if (msg[0] === 'getMessages') {
            currBoard = msg[1];
            threadID = msg[2];

            //Sanity check
            console.log(`Got command ${msg[0]} from client ${clientIP} who is on board ${currBoard}:${threadID}.`);

            clients.set(clientIP, {
                socket: ws,
                board: currBoard,
                threadID: threadID,
                IP: clientIP,
                upload: ``
            });
            if (parseInt(currBoard) > 0) {
                return;
            }
            if (msg[0] in cmd) {
                var funct = cmd[msg[0]];
                funct(clientIP, currBoard, threadID);
            }
        }

    });

    // Server commands go here
    const cmd = {
        getMessages: (clientIP, boardNum, threadID) => {
            boardNum = parseInt(boardNum);
            console.log(`${boardNum}:${threadID} to ${clientIP}.`);
            clients.get(clientIP).board = boardNum;
            collection = database.collection('posts');
            collection.find({
                board: boardNum,
                threadID: threadID
            }).toArray(function (err, docs) {
                assert.equal(err, null);
                parsedDocs = JSON.stringify(docs);
                console.log(`${clientIP} requested contents of ${threadID}`);
                ws.send(JSON.stringify({
                    command: 'displayMessages',
                    argument: docs
                }));

            });
        },

        getThreads: (clientIP, boardNum) => {
            boardNum = parseInt(boardNum);
            console.log(`Board ${boardNum} to ${clientIP}.`);
            clients.get(clientIP).board = boardNum;
            collection = database.collection('threads');
            collection.find({
                board: boardNum

            }).sort({
                "date": -1
            }).toArray(function (err, docs) {
                assert.equal(err, null);
                parsedDocs = JSON.stringify(docs);
                ws.send(JSON.stringify({
                    command: 'displayThreads',
                    argument: docs
                }));
            });
        },

        submitMessage: (clientIP, boardNum, threadID, nick, post) => {
            if (!post) {
                alertStr = 'No message submitted.';
                wsAlert(clientIP, alertStr);
                return;
            } else if (throttledUsers.has(clientIP)) {
                alertStr = 'Please wait longer before submitting a new post.';
                wsAlert(clientIP, alertStr);
                return;
            }
            throttledUsers.add(clientIP);
            clearThrottles(clientIP);
            picName = clients.get(clientIP).upload;
            console.log(`Picture: ${picName} for submission`);
            console.log(`Post: ${post} for submission`);
            console.log(`This post should be submitted to ${threadID}`);

            if (picName) {
                pic = `http://localhost/${picName}`;
            } else {
                pic = '';
            }
            boardNum = parseInt(boardNum);
            let dateNow = Date.now();
            if (post.length > 450) {
                return;
            } else {
                collection = database.collection('posts');
                collection2 = database.collection('threads');
                nick ? username = nick : username = 'Anonymous';
                if (post) {
                    collection.find().limit(1).sort({
                        $natural: -1
                    }).toArray(function (err, docs) {
                        assert.equal(err, null);
                        docs[0] ? postID = docs[0].postID + 1 : postID = 1;
                        messageObj = {
                            board: boardNum,
                            nick: username,
                            message: post,
                            threadID: threadID,
                            pic: pic,
                            date: dateNow,
                            postID: postID
                        }
                        collection2.updateOne({
                            threadID: threadID
                        }, {
                            $set: {
                                date: dateNow
                            }
                        }).then(
                            collection.insertOne(messageObj).then(function () {
                                console.log(`completed message submission to #${threadID} time to broadcast`);
                                wsBroadcastThread(JSON.stringify({
                                    command: 'displayMessage',
                                    argument: messageObj
                                }), boardNum, threadID)
                            }));
                    });
                }
            }
        },

        submitThread: (clientIP, boardNum, subj, nick, message) => {
            picName = clients.get(clientIP).upload;

            if (!picName) {
                alertStr = `You didn't upload an image.`;
                wsAlert(clientIP, alertStr);
                return;
            } else if (!message) {
                alertStr = `You didn't enter a message.`;
                wsAlert(clientIP, alertStr);
                return;
            }

            if (throttledUsers2.has(clientIP)) {
                alertStr = 'Please wait longer before submitting a new thread.';
                wsAlert(clientIP, alertStr);
                return;
            }
            throttledUsers2.add(clientIP);
            clearThrottles2(clientIP);
            picName = clients.get(clientIP).upload;
            console.log(`${picName} for submission`);
            if (picName) {
                pic = `http://localhost/${picName}`;
            } else {
                pic = '';
            }
            boardNum = parseInt(boardNum);
            let dateNow = Date.now();
            if (subj.length > 30) {
                return;
            } else {
                let threadID, threadObj, messageObj;
                collection = database.collection('threads');
                collection2 = database.collection('posts');
                nick ? username = nick : username = 'Anonymous';
                if (message) {
                    collection.find().limit(1).sort({
                        $natural: -1
                    }).toArray(function (err, docs) {
                        assert.equal(err, null);
                        threadID = makeid();

                        console.log(threadID);
                        threadObj = {
                            board: boardNum,
                            nick: username,
                            title: subj,
                            message: message,
                            threadID: threadID,
                            pic: pic,
                            date: dateNow
                        }
                        if (threadObj && threadID) {
                            collection.insertOne(threadObj).then(function () {
                                collection2.find().limit(1).sort({
                                    $natural: -1
                                }).toArray(function (err, docs) {
                                    assert.equal(err, null);
                                    docs[0] ? postID = docs[0].postID + 1 : postID = 1;
                                    messageObj = {
                                        board: boardNum,
                                        nick: username,
                                        title: subj,
                                        message: message,
                                        threadID: threadID,
                                        pic: pic,
                                        date: dateNow,
                                        postID: postID
                                    }
                                    if (messageObj && postID > -1) {
                                        collection2.insertOne(messageObj);
                                    }
                                });
                            }).then(function () {
                                setTimeout(function () {
                                    cmd.getNewThread(clientIP, boardNum)
                                }, 500);
                            });
                        }
                    });
                }
            }
        },

        getNewThread: (clientIP, boardNum) => {
            collection.find().limit(1).sort({
                $natural: -1
            }).toArray(function (err, docs) {
                assert.equal(err, null);
                newThread = docs[0].threadID;
                collection2.find({
                    board: boardNum,
                    threadID: newThread
                }).toArray(function (err, docs) {
                    assert.equal(err, null);
                    parsedDocs = JSON.stringify(docs);
                    wsBroadcastBoard(JSON.stringify({
                        command: 'displayThread',
                        argument: docs[0]
                    }), boardNum);
                });
            });
        }
    }
});

wsBroadcastBoard = function (data, boardNum) {
    clients.forEach(function (client) {
        if (client.board == boardNum && client.threadID == 0) {
            client.socket.send(data);
        }
    });
};

wsBroadcastThread = (data, boardNum, threadID) => {
    clients.forEach(function (client) {
        if (client.threadID == threadID) {
            client.socket.send(data);
        }
    });
};

wsBroadcast = (data) => {
    clients.forEach(function (client) {
        client.socket.send(data);
    });
};

wsBroadcastUser = (clientIP, data) => {
    clients.forEach(function (client) {
        if (client.IP == clientIP) {
            client.socket.send(data);
        }
    });
}

wsAlert = (clientIP, alertStr) => {
    newAlert = JSON.stringify({
        alert: alertStr
    });
    wsBroadcastUser(clientIP, newAlert);
}

clearThrottles = (IP) => {
    setTimeout(function () {
        throttledUsers.delete(IP);
        console.log(throttledUsers);
    }, 500);
}

clearThrottles2 = (IP) => {
    setTimeout(function () {
        throttledUsers2.delete(IP);
        console.log(throttledUsers2);
    }, 500);
}

function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 16; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

//webserver code
app.use(ddos.express);
app.use(cors());
app.use(fileUpload());
app.use("/", express.static(__dirname + '/public/'));
app.use(express.static('dir'));
app.post('/upload', function (req, res) {
    if (Object.keys(req.files).length == 0) {
        console.log('No files were uploaded.');
        return;
    }

//file upload code
    let reqIP;
    cloudflare ? clientIP = req.headers['cf-connecting-ip'] : clientIP = req.connection.remoteAddress
    let fileName = file.name;
    let picType = fileName.substr(fileName.length - 3, fileName.length - 1);
    let mimetype = file.mimetype;
    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
        alertStr = 'File type must be png or jpg.';
        wsAlert(reqIP, alertStr);
        return;
    }
    if (file.data.length > 2000000) {
        alertStr = 'File size is too large.';
        wsAlert(reqIP, alertStr);
        return;
    }
    let realName = `${Math.floor(Math.random() * 999999999999)}.${picType}`;
    let reqSocket = clients.get(reqIP).socket;
    let boardNum = clients.get(reqIP).board;
    let threadID = clients.get(reqIP).threadID;
    clients.set(reqIP, {
        socket: reqSocket,
        board: boardNum,
        threadID: threadID,
        IP: reqIP,
        upload: `${realName}`
    });
    console.log(`${realName} uploaded by ${reqIP} at ${Date.now()}`);
    file.mv(`/dir/${realName}`, function (err) {
        if (err) {
            console.log(err);
            alertStr = 'Upload failed.';
            wsAlert(reqIP, alertStr);
            return;
        } else {
            alertStr = 'File uploaded!';
            wsAlert(reqIP, alertStr);
        }

    });
});

//run the webserver
webServer.listen(80, function listening() {
    console.log('Listening on %d', webServer.address().port);
});