require("dotenv").config();
const express = require('express');
const canvas = require("canvas");
const nocache = require('nocache');
const app = express();
const { Users, Comments, Images } = require("./database.js");
const session = require("express-session");
const nunjucks = require("nunjucks");
const morgan = require("morgan");

app.use(morgan("dev"));

app.use(express.static("public"));
nunjucks.configure("views", {
    autoescape: true,
    express: app
});
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));
app.get("/create", async (req, res) => {
    res.render("create.html");
});
app.post("/create", express.urlencoded({ extended: true }), async (req, res) => {
    var { title, width, height } = req.body;
    var id = await Images.addImage(req.session.userID, `https://localhost:3000/comments/${id}`, parseInt(width), parseInt(height), title);
    res.redirect(`/comments/${id}`);
});
app.get("/comments/:id", nocache(), async (req, res) => {
    var image = await Images.getImageById(req.params.id);
    if (image == undefined) {
        var can = canvas.createCanvas(500, 500);
        var ctx = can.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, can.width, can.height);
        ctx.fillStyle = "black";
        ctx.font = "30px Arial";
        ctx.fillText("404 not found", 10, 50);
        res.set("Content-Type", "image/jpeg");
        res.status(404);
        return res.send(can.toBuffer());
    }
    var comments = await Comments.getCommentsByImage(image.id);
    var finalHeight = await dryRun(image, comments);
    var can = canvas.createCanvas(image.width, (finalHeight > image.height) ? finalHeight : image.height);
    var ctx = can.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, can.width, can.height);
    ctx.fillStyle = "black";
    ctx.font = "30px Arial";
    ctx.fillText("Comments: " + image.title, 10, 50);
    var comments = comments.filter((comment) => !comment.replyTo);
    ctx.font = "20px Arial";
    var nextLineY = 100;
    for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        nextLineY = await printComment(can, ctx, comment, nextLineY, 0);
    }
    res.set("Content-Type", "image/jpeg");
    res.send(can.toBuffer());
});
app.get("/", (req, res) => {
    res.send("Hello, world");
});
app.get("/comment/:id", async (req, res) => {
    var image = await Images.getImageById(req.params.id);
    if (!image || image == null) {
        return res.send("Image not found");
    }
    res.render("comment.html", { image });
});
app.post("/comment", express.urlencoded({ extended: true }), async (req, res) => {
    var { comment, replyTo, id } = req.body;
    await Comments.addComment(req.session.userID, comment, parseInt(id), parseInt(replyTo) || null);
    res.redirect(`/comments/${id}`);
});
app.post('/signup', express.json(), async (req, res) => {
    var { username, password, email, bio, pfp } = req.body;
    var num = await Users.addUser(username, password, email, bio, pfp, true, true);
    res.send('You are the ' + num + 'th user!');
});
app.listen(3000);


function printAtWordWrap(context, text, x, y, lineHeight, fitWidth) {
    console.log(text)
    fitWidth = fitWidth || 0;
    if (fitWidth <= 0) {
        context.fillText(text, x, y);
        return;
    }

    var words = text.split(" ");
    var lines = [];
    var currentLine = 0;
    var left = 0;
    for (var i = 0; i < words.length; i++) {
        var word = words[i];
        if (word == "\n") {
            lines.push(words.slice(left, i).join(' '));
            left = i + 1;
            continue;
        }
        var toprint = words.slice(left, i).join(' ');
        var metrics = context.measureText(toprint);
        var testWidth = metrics.width;
        if (testWidth > fitWidth) {
            lines.push(words.slice(left, i - 1).join(' '));
            left = i - 1;
        } else {
            continue;
        }
    }
    if(left < words.length){
        lines.push(words.slice(left, words.length).join(' '));
    }
    console.log(lines)
    lines = lines.map((line) => {
        return line.trim().split("\n");
    });
    console.log(lines)
    lines.flat().forEach(line => {
        console.log(line)
        context.fillText(line, x, y + (currentLine * lineHeight));
        currentLine++;
    });

    return currentLine * lineHeight;
}
async function dryRun(image, comments, offset = 50) {
    var can = canvas.createCanvas(image.width, image.height);
    var ctx = can.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, can.width, can.height);
    ctx.fillStyle = "black";
    ctx.font = "30px Arial";
    ctx.fillText("Comments: " + image.title, 10, 50);
    var comments = comments.filter((comment) => !comment.replyTo);
    ctx.font = "20px Arial";
    var nextLineY = 100;
    for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        nextLineY = await printComment(can, ctx, comment, nextLineY, 0);
    }
    return nextLineY + offset;
}
async function printComment(can, ctx, comment, nextLineY, buffer = 0, isReply = false) {
    var user = (await Users.getUserById(comment.userID))
    const username = (user) ? user.username || "Anonymous" : "Anonymous";
    var replies = await Comments.getRowsByField("replyTo", comment.id);
    var uWidth = ctx.measureText(username + ": ").width;
    ctx.fillText(username + ": ", 10 + buffer, nextLineY);
    var height = printAtWordWrap(ctx, comment.comment, 10 + uWidth + buffer, nextLineY, 25, can.width - 20 - uWidth);
    nextLineY += height + 50;
    for (let i = 0; i < replies.length; i++) {
        nextLineY = await printComment(can, ctx, replies[i], nextLineY, uWidth, true);
    }
    return nextLineY;
}