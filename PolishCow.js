const { resolve } = require("path");
const sound = require("sound-play");
const mm = require("music-metadata");
const fs = require("fs");
const asciify = require("asciify-image");

const animation = require("./animation.json");

const cursor = require("ansi")(process.stdout);


/**
 * All pre-calculated frames are saved to this object
 * @prop {String[][][]} [0x0] Example
 */
var frameSets = {};


/** Settings for Polish Cow */
const settings = {
    /** Set to true to enable debug messages */
    dbg: false,
    /** Path to the sound file */
    soundFile: resolve("./polishcow.mp3"),
    /** Adds this amount of seconds to the played audio file since the sound-play package is pretty inaccurate */
    endBuffer: 0.4,
    /** Interval (in seconds) between the single frames of the animation */
    animationInterval: 0.2,
    /** In which sequence to play the animations */
    animationSequence: [ 0, 1, 0, 1, 2, 3, 4, 5, 4, 5, 3, 2 ],
    /** [ Width, Height ] - By what number to decrease height or width by, globally */
    animationPadding: [ 0, 0 ],
    /** Options for the package asciify-image - Documentation: https://www.npmjs.com/package/asciify-image#optionscolor */
    asciifyOpts: {
        color: false,
        fit: "box",
        format: "array",
        width: 200,
        height: 100
    }
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
    if(!process.stdout.isTTY)
    {
        console.log(`\n\x1b[31m\x1b[1mStandard output channel is not a TTY (terminal)\x1b[0m\n\n(Process exits automatically)\n`);

        setTimeout(() => process.exit(1), 10000);
    }
    else
    {
        if(!fs.existsSync(settings.soundFile))
        {
            console.log(`\n\x1b[31m\x1b[1mSound file at path "${settings.soundFile}" doesn't exist.\x1b[0m\n\n(Process exits automatically)\n`);
            
            setTimeout(() => process.exit(1), 10000);
        }
        else
        {
            cursor.hide();

            setWindowTitle("Polish Cow - Sv443");
            play(settings.soundFile, true);
            
            calculateCurrentFrameSet().then(() => {
                startAnimation();
            });

            process.stdout.on("resize", () => {
                if(settings.dbg)
                    console.log(`RESIZE EVENT TRIGGERED`);

                cursor.hide();
                calculateCurrentFrameSet().then(() => {
                    redrawFrame();
                });
            });
        }
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
    }, settings.animationInterval * 1000);

    if(!animationPaused)
    {
        displayFrame(settings.animationSequence[currentAnimSequenceIdx]);
        currentAnimSequenceIdx++;
    }
}

/** 
 * Calculates the frame set of the current window resolution
 */
function calculateCurrentFrameSet()
{
    return new Promise((pRes, pRej) => {
        //TODO: parallelized frame set calculation
    });
}

/**
 * Redraws the current frame without incrementing any counters or advancing the animation sequence
 */
function redrawFrame()
{
    //TODO:
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

/**
 * Converts an image at the provided path to ASCII art with dimensions being determined by terminal size
 * @param {String} imgSrc Path to the image
 * @returns {Promise[String[]]} Resolves with a 2D array of strings or rejects with an error message
 */
function imageToResponsiveAscii(imgSrc)
{
    return new Promise((pRes, pRej) => {
        imgSrc = resolve(imgSrc);

        settings.asciifyOpts.width = (process.stdout.columns - settings.animationPadding[0]);
        settings.asciifyOpts.height = (process.stdout.rows - settings.animationPadding[1]);

        asciify(imgSrc, settings.asciifyOpts)
        .then(res => {
            return pRes(res);
        })
        .catch(err => {
            return pRej(err);
        });
    });
}







PolishCow();