require("dotenv").config();
const express = require('express');
const canvas = require("canvas");
const nocache = require('nocache');
const app = express();
const { Users, Comments, Images } = require("./database.js");
const session = require("express-session");
const nunjucks = require("nunjucks");
const morgan = require("morgan");
const multer = require('multer');
const badWords = require("bad-words");
const { supabaseStorage } = require("./storage.js");

const upload = multer({
    storage: supabaseStorage()
});
app.use(morgan("dev"));
app.set("view engine", "html");	
app.set("etag",false);
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
app.get("/login", (req, res) => {
    res.render("login.html");
});
app.get("/signup", (req, res) => {
    res.render("signup.html");
});
app.post("/signup", upload.single('pfp'), express.urlencoded({ extended: true }), async (req, res) => {
    var { username, password, email } = req.body;
    var pfp = null;
    if (req.file) {
        pfp = `https://${process.env.SUPABASE_ID}.supabase.co/storage/v1/object/public/profile-pics${req.file.path}`
    } else {
        pfp = null;
    }
    var exists = await Users.getRowsByField("username", username);
    var exists2 = await Users.getRowsByField("email", email);
    if (exists.length > 0) {
        return res.redirect("/signup?error=Username taken");
    }
    if (exists2.length > 0) {
        return res.redirect("/signup?error=Email taken");
    }
    var user = await Users.addUser(username, password, email, pfp, true, true);
    delete user.password;
    req.session.loggedIn = user.id;
    req.session.user = user;
    res.redirect(req.session.goto || "/create")
});
app.post("/login", express.urlencoded({ extended: true }), async (req, res) => {
    var { username, password } = req.body;
    var user = await Users.login(username, password);
    if (user) {
        req.session.loggedIn = user.id;
        delete user.password;
        req.session.user = user;
        res.redirect(req.session.goto || "/create");
    } else {
        res.send("Invalid login");
    }
});
app.get("/create", async (req, res) => {
    res.render("create.html");
});
app.post("/create", express.urlencoded({ extended: true }), async (req, res) => {
    var { title, width, height, nameRequired, loggedInRequired, verifiedRequired, filterBadWords } = req.body;
    var id = await Images.addImage(req.session.loggedIn, parseInt(width), parseInt(height), title, nameRequired, loggedInRequired, verifiedRequired, filterBadWords);
    res.redirect(`/getCode/${id}`);
});
app.get("/getCode/:id", async (req, res) => {
    var image = await Images.getImageById(req.params.id);
    res.render("getCode.html", { image });
});
app.get("/comments/:id.:ext",(req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
}, imageRoute);
app.get("/comments/:id", (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
}, imageRoute);
async function imageRoute(req, res) {
    if (req.session.goto) {
        req.session.goto = null;
    }
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
    finalHeight += 50;
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
    ctx.strokeStyle = "black";
    ctx.moveTo(0, can.height - 30);
    ctx.beginPath();
    ctx.lineTo(0, can.height - 30);
    ctx.lineTo(can.width, can.height - 30);
    ctx.stroke();
    ctx.font = "14px Arial";
    ctx.fillText("Click to comment", 10, can.height - 10);
    var copyText = `Made with image-comments`;
    ctx.fillText(copyText, can.width - ctx.measureText(copyText).width - 10, can.height - 10);
    res.set("Content-Type", "image/jpeg");


    res.send(can.toBuffer());
}
app.get("/", (req, res) => {
    res.render("index.html")
});
app.get("/gatherName", (req, res) => {
    res.render("gatherName.html");
});
app.post("/gatherName", express.urlencoded({ extended: true }), async (req, res) => {
    req.session.username = req.body.name;
    console.log(req.session.name)
    res.redirect(req.session.goto || "/");
});
app.get("/comment/:id", async (req, res) => {
    if (req.session.goto) {
        req.session.goto = null;
    }
    var image = await Images.getImageById(req.params.id);
    if (!image || image == null) {
        return res.send("Image not found");
    }
    if (image.loggedInRequired && !req.session.loggedIn) {
        req.session.goto = `/comment/${req.params.id}`;
        return res.redirect("/login");
    }
    if (image.nameRequired && !req.session.username && !req.session.loggedIn) {
        req.session.goto = `/comment/${req.params.id}`;
        return res.redirect("/gatherName");
    }
    if (image.verifiedRequired && !req.session.user.verified) {
        return res.redirect("/verify");
    }

    res.render("comment.html", { image });
});
app.post("/comment", express.urlencoded({ extended: true }), async (req, res) => {
    var { comment, replyTo, id } = req.body;
    var uString = "";
    if (req.session.loggedIn) {
        uString = req.session.user.username;
    } else if (req.session.username) {
        uString = req.session.username;
    } else {
        uString = "Anonymous";
    }
    var on = await Images.getImageById(parseInt(id));
    if (on.filterBadWords) {
        var filter = new badWords();
        comment = filter.clean(comment)
    }
    console.log(req.session);
    await Comments.addComment(req.session.loggedIn, comment, parseInt(id), uString, parseInt(replyTo) || null);
    res.redirect(`/comments/${id}`);
});
app.post('/signup', express.json(), async (req, res) => {
    var { username, password, email, bio, pfp } = req.body;
    var num = await Users.addUser(username, password, email, bio, pfp, true, true);
    res.send('You are the ' + num + 'th user!');
});
app.listen(3000);


function printAtWordWrap(context, text, x, y, lineHeight, fitWidth) {
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
    if (left < words.length) {
        lines.push(words.slice(left, words.length).join(' '));
    }
    lines = lines.map((line) => {
        return line.trim().split("\n");
    });
    lines.flat().forEach(line => {
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
    try {
        var username = comment.authorName;
        var replies = await Comments.getRowsByField("replyTo", comment.id);

        var metrics = ctx.measureText(username + ": ");
        var uWidth = metrics.width;
        if (username != "Anonymous" && !isReply) {
            var user = await Users.getUserById(comment.creatorID);
            if (user) {
                var pfp = user.pfp;
                console.log(pfp);
                var img = await canvas.loadImage(pfp);
                var uHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
                ctx.save();
                ctx.beginPath();
                ctx.arc(20, nextLineY - uHeight + 10, 10, 0, 2 * Math.PI);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(img, 10, nextLineY - uHeight, 20, 20);
                ctx.restore();
                buffer += 25;
            }
        }
        ctx.fillText(username + ": ", 10 + buffer, nextLineY);
        var height = printAtWordWrap(ctx, comment.comment, 10 + uWidth + buffer, nextLineY, 25, can.width - 20 - uWidth);
        nextLineY += height + 50;
        for (let i = 0; i < replies.length; i++) {
            nextLineY = await printComment(can, ctx, replies[i], nextLineY, uWidth, true);
        }
        return nextLineY;
    } catch (e) {
        console.log(e);
        return nextLineY;
    }
}