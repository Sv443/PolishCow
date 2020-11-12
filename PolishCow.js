const { resolve } = require("path");
const sound = require("sound-play");
const mm = require("music-metadata");
const fs = require("fs");

const animation = require("./animation.json");

const cursor = require("ansi")(process.stdout);



const settings = {
    /** Set to true to enable debug messages */
    dbg: false,
    /** Path to the sound file */
    soundFile: resolve("./polishcow.mp3"),
    /** Adds this amount of seconds to the played audio file since the sound-play package is pretty inaccurate */
    endBuffer: 0.4,
    /** [ width, height ] - how big the terminal needs to be to play the animation */
    minSize: [ 80, 30 ],
    /** Interval (in seconds) between the single frames of the animation */
    animationInterval: 0.2,
    /** In which sequence to play the animations */
    animationSequence: [ 0, 1, 0, 1, 2, 3, 4, 3, 4, 2 ]
};

/** @type {Boolean} Set to true to pause the animation */
var animationPaused = false;

/** Current sequence index of the animation */
var currentAnimSequenceIdx = 0;



/**
 * Runs the "program"
 */
async function PolishCow()
{
    if(!fs.existsSync(settings.soundFile))
    {
        console.log(`\n\x1b[31m\x1b[1mSound file at path "${settings.soundFile}" doesn't exist.\x1b[0m\n\n(Process exits automatically)\n`);
        
        setTimeout(() => process.exit(1), 10000);
    }
    else
    {
        cursor.hide();
        checkSize();

        play(settings.soundFile, true);

        process.stdout.on("resize", () => {
            if(settings.dbg)
                console.log(`RESIZE EVENT TRIGGERED`);

            cursor.hide();
            checkSize();
        });

        startAnimation();

        setWindowTitle("Polish Cow - Sv443");
    }
}

/**
 * Checks if the terminal size is okay
 */
function checkSize()
{
    /** @type {Number[]} [ width, height ] */
    let size = [ process.stdout.columns, process.stdout.rows ];

    if(size[0] < settings.minSize[0] || size[1] < settings.minSize[1])
        animationPaused = true;
    else
    {
        if(animationPaused == true)
            animationPaused = false;
    }
}

/**
 * Starts the animation
 */
function startAnimation()
{
    let frames = [];

    animation.forEach((frame, idx) => {
        let logTxt = frame.join("\n");

        frames.push(logTxt);

        if(settings.dbg)
            console.log(`Loaded animation frame #${idx}`);
    });

    if(settings.dbg)
        console.log(`Done loading animation. Playing it...`);


    const displayFrame = idx => {
        let frameText = frames[idx];

        console.clear();
        if(settings.dbg)
            console.log(`Displaying frame #${idx} (Sequence: ${settings.animationSequence.join(" ")})\n`);

        console.log(`\n\n${frameText}\n`);
    };


    setInterval(() => {
        if(!animationPaused)
        {
            displayFrame(settings.animationSequence[currentAnimSequenceIdx]);
            currentAnimSequenceIdx++;

            if(currentAnimSequenceIdx >= settings.animationSequence.length)
                currentAnimSequenceIdx = 0;
        }
        else
        {
            console.clear();
            console.log(`\x1b[31m\x1b[1mWindow size too small!\x1b[0m\n\nExpected: ${settings.minSize[0]}x${settings.minSize[1]}\nCurrent:  ${process.stdout.columns}x${process.stdout.rows}`);
        }
    }, settings.animationInterval * 1000);

    if(!animationPaused)
    {
        displayFrame(settings.animationSequence[currentAnimSequenceIdx]);
        currentAnimSequenceIdx++;
    }
}


/**
 * Plays a sound file (supports MP3, WAV and other formats)
 * @param {String} fPath File path to the sound file
 * @param {Boolean} [loop=false] Whether to loop the sound infinitely
 * @returns {Promise} Resolves promise once the sound finishes playing
 */
function play(fPath, loop)
{
    if(typeof loop != "boolean")
        loop = false;

    return new Promise((pRes) => {
        fPath = resolve(fPath);

        const playSoundFile = (meta, fPath) => {
            let songLength = parseFloat(meta.format.duration.toFixed(3));
            
            // console.log(`File is ${songLength} seconds long`);

            sound.play(fPath);

            setTimeout(() => {
                // console.log(`EOF`);
                if(!loop)
                    return pRes();
                else
                    playSoundFile(meta, fPath);
            }, (songLength + settings.endBuffer) * 1000);
        }
    
        mm.parseFile(fPath, {
            duration: true
        }).then(meta => {
            playSoundFile(meta, fPath);
        });
    });
}

/**
 * Sets the CLI window's title (supports Windows and *nix)  
 * Stolen from my other project - Townly
 * @param {String} title
 */
function setWindowTitle(title)
{
    if(typeof title.toString == "function")
        title = title.toString();

    if(process.platform != "win32")
        process.stdout.write(`\x1b]2;${title}\x1b\x5c`); // *nix doesn't have a nice way to set the window title but this escape sequence should be able to do it (for reference search "OSC control sequences" on this page: https://man7.org/linux/man-pages/man4/console_codes.4.html)
    else
        process.title = title; // This should work only on Windows
}







PolishCow();