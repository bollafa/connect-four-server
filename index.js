const express = require('express');
const app = express();
const expressWs = require('express-ws')(app);
const crypto = require('crypto'); 
const uuidv4 = require('uuid/v4');
var players = {}
var matches = {}
function str(a) { return JSON.stringify(a); }
function create_feedback(feedback,error) {
    return { "reason": "feedback_packet",
        "feedback": feedback, "error" : error }; 
}
function process_packet(packet,sender) {
    let feedback = "none";
    try {
        switch(packet["reason"]){
            case 'create_match_packet':
                feedback = "create"
                create_match(packet,sender);
                break;
            case 'join_match_packet':
                feedback = "join"
                join_match(packet,sender);
                break;
            case 'insert_packet':
                feedback = "insert"
                insert(packet,sender);
                break;
            case 'concede_packet':
                feedback = "concede"
                concede(packet);
                break;
            default:
               throw "Unknown packet!";
        }
        } catch (exception) {
       throw create_feedback(feedback,exception);
    }
}
function side(mode,number_players,starting_piece,colors) {
    console.log(starting_piece, "colors: ", colors);
    if(number_players == 2){
        return colors.pop();
    }
    switch(starting_piece) {
        case 'red':
            if(number_players == 1){
                let pos = colors.indexOf('red');
                colors.splice(pos,1);
                return 'red';
            }
            break;
        case 'yellow':
            if(number_players == 1){

                let pos = colors.indexOf('yellow');
                colors.splice(pos,1);
                return 'yellow';
            }
            break;
        case 'random':
            let item = Math.floor(Math.random()*colors.length);
            let color = colors[item]
            colors.splice(item,1);
            return color;
        default:
            return "spectator";
    }
}
function create_match(packet,sender){
    if(!( packet["token"] in players )){
        throw "Couldnt create match: unregistered token!";
    }

    if( packet["name"] in matches) {
        throw "Couldnt create match: match already exists!";
    }
    matches[packet["name"]] = { "clients" : [sender] }; 
    matches[packet["name"]]["colors"] = ["red","yellow"];
    matches[packet["name"]][packet["token"]] = side(packet["mode"],1,
    packet["starting_piece"],matches[packet["name"]]["colors"]);
    matches[packet["name"]]["tops"] = Array(7).fill(0);
    matches[packet["name"]]["number_players"] = 1;
    sender.on('close', (code,reason) =>{ 
        console.log("closing! ",reason);
        concede(packet);
    });

    matches[packet["name"]]["clients"].forEach(function each(client){
            client.send(str(create_feedback("create","OK")));
    });
}

function join_match(packet,sender){
    
    if(!( packet["token"] in players )){
        throw "Couldnt join match: unregistered token!";
    }

    if( !(packet["name"] in matches)) {
        throw "Couldnt join match: match doesnt exist!";
    }
    if( packet["token"] in matches[packet["name"]]) {
        return;
    }
    matches[packet["name"]]["clients"].push(sender);
    matches[packet["name"]][packet["token"]] = side(packet["mode"],2,undefined,matches[packet["name"]]["colors"]);
    sender.on('close', (code,reason) => { 
        console.log("closing! ",reason, " name:", packet["name"]);
        concede(packet);
    });
    
    matches[packet["name"]]["clients"].forEach(function each(client){
            client.send(str(create_feedback("join","OK")));
    });
    matches[packet["name"]]["number_players"]++;
}
function can_play(token,match,column) {
    let tops = match["tops"];
    return tops[column] < 6 && 
    match["last"] != token
    && match["number_players"] >= 2;
}

function play(token,match,column) {
        let tops = match["tops"];
        tops[column]++;
        match["last"] = token;
}

function insert(packet,sender){
    
    if(!( packet["token"] in players )){
        throw "Couldnt insert: unregistered token!";
    }

    if( !(packet["name"] in matches)) {
        throw "Couldnt insert: match doesnt exist!";
    }
    if( !(packet["token"] in matches[packet["name"]])) {
        throw "Couldnt insert: token not in match!";
    }
    if( matches[packet["name"]][packet["token"]] === "spectator" ){
        throw "Couldnt insert: spectators cannot play!"
    }
    packet["mode"] = matches[packet["name"]][packet["token"]];
    //console.log(tops[packet["column"]], " at: ", packet["column"]); 
    if(can_play(packet["token"],matches[packet["name"]],packet["column"])){
        play(packet["token"],matches[packet["name"]],packet["column"]);
        matches[packet["name"]]["clients"].forEach(function each(client){
                client.send(str(packet));
        });
    }

}
function concede(packet){
    
    if( !(packet["name"] in matches)) {
        //throw "Couldnt concede: match doesnt exist!";
        return;
    }
    if( !(packet["token"] in matches[packet["name"]])) {
        throw "Couldnt concede: token not in match!";
    }
    if( matches[packet["name"]][packet["token"]] === "spectator" ){
        throw "Couldnt concede: spectators cannot concede!"
    }
    matches[packet["name"]]["number_players"]--;
    if(matches[packet["name"]]["number_players"] <= 0){
        delete matches[packet["name"]];
    }
}
app.ws('/', function(ws, req) {
    let playerID = (uuidv4());
    players[playerID] = {};
    players[playerID]["status"] = "connected";
    let token_packet = { "reason" : "token_packet", "token" : playerID };
    ws.send(str(token_packet));

    ws.on('message',function(msg) {
        let packet = {}
        try{
            packet = JSON.parse(msg);
            process_packet(packet,ws);
        }catch(exception){
            console.log(exception);
            console.log("Invalid packet received!: ", msg);
            ws.send(str(exception));
        }
    });


});
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
} 
app.listen(port);
