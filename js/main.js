// HTML elements
let UI = {
    main: document.querySelector('main'),
    keyboard: document.querySelector('keyboard'),
    message: document.querySelector('message'),
    message_text: document.querySelector('message p'),
    message_solution: document.querySelector('message span'),
    messages: {
        won: {
            main: 'Gewonnen in ',
            span: '%i Versuchen.'
        },
        lost: {
            main: 'Verloren. Lösung: ',
            span: '%w.'
        }
    },
    cells: []
}

// alphabet for letter parsing
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// determines how many tries per word relative to word length
// e.g. with a 5 letter word, AMOUNT_TRIES = 2 would mean 10 tries
const AMOUNT_TRIES = 1.5

// lexicon of german words
let lexicon

// list of solutions/guessing words
let wordlist

// current word
let word

// amount of guesses (gets determined by wordlength)
let guesses

// currently selected cell for typing
let cell_selection

// game state
let gameover

// load words an start
async function setup() {
    // load words
    let words = await fetch('wordlist.json')
    words = await words.json()
    wordlist = words.words

    // load lexicon
    let lex = await fetch('lexicon.json')
    lexicon = await lex.json()

    // inject character preview
    ALPHABET.split('').forEach(char => {
        let el_char = document.createElement('char')
        el_char.setAttribute('value', '-1')
        el_char.textContent = char
        UI.keyboard.append(el_char)
    })

    // start
    reset()
}

// reset the round
function reset(given_word) {
    // reset game state
    gameover = false

    // pick random word
    word = given_word?.toUpperCase() || random_word()

    // set status message
    UI.message_text.textContent = ''
    UI.message_solution.textContent = ''
    UI.message.className = ''

    // set amount of guesses based on word length
    guesses = Math.ceil(word.length * AMOUNT_TRIES)

    // clear grid
    UI.cells.forEach(row => row.forEach(cell => cell.remove()))
    UI.cells = []

    // create rows and cells
    for (let y = 0; y < guesses; y++) {
        // create new row
        let row = document.createElement('row')
        row.setAttribute('y', y)
        UI.cells.push([])

        for (let x = 0; x < word.length; x++) {
            // create new cell
            let cell = document.createElement('input')
            cell.setAttribute('x', x)
            cell.setAttribute('y', y)
            cell.disabled = true
            cell.setAttribute('enabled', false)

            // add eventlistener
            cell.addEventListener('click', c => {
                if (gameover || cell.getAttribute('disabled') == 'true') return

                // select cell on click
                cell_selection = cell
            })

            // append to row
            row.append(cell)
            UI.cells[y].push(cell)
        }

        // append to body
        UI.main.append(row)
    }

    // enable input on first row
    UI.cells[0].forEach(row => {
        row.setAttribute('enabled', true)
        row.disabled = false
    })

    // set selected cell to first cell
    cell_selection = UI.cells[0][0]
    UI.cells[0][0].focus()

    // reset character preview
    document.querySelectorAll('keyboard char').forEach(char => char.setAttribute('value', '-1'))
}

// handle arrow and alphabetic keys
document.addEventListener('keydown', event => {
    if (gameover) return

    // current cell selection x and y coordinates
    let selection = {
        x: parseInt(cell_selection.getAttribute('x')),
        y: parseInt(cell_selection.getAttribute('y'))
    }

    // decide action based on key 
    if (['ArrowRight', 'Tab'].includes(event.key) && selection.x < word.length - 1) {
        // move right
        cell_selection = UI.cells[selection.y][selection.x + 1]
        cell_selection.focus()
    } else if (event.key === 'ArrowLeft' && selection.x > 0) {
        // move left
        cell_selection = UI.cells[selection.y][selection.x - 1]
        cell_selection.focus()
    } else if (event.key === 'Backspace') {
        // delete textContent
        cell_selection.value = ''

        if (selection.x > 0) {
            // move left if not already leftmost
            cell_selection = UI.cells[selection.y][selection.x - 1]
            cell_selection.focus()
        }
    } else if (event.key === 'Delete') {
        // delete textContent without moving
        cell_selection.value = ''
    } else if (ALPHABET.includes(event.key.toUpperCase()) && cell_selection && cell_selection.disabled == false) {
        event.preventDefault()

        // change text
        cell_selection.value = event.key.toUpperCase()

        // move to right cell if this one's not the last in row
        if (selection.x < word.length - 1) {
            cell_selection = UI.cells[selection.y][selection.x + 1]
            cell_selection.focus()
        }
    } else if (event.key === 'Enter') submit_row()
    else if (event.key.match(/[a-zA-Z0-9_]*/)) event.preventDefault()
})

// submit the guess
function submit_row() {
    // current cell selection x and y coordinates
    let selection = {
        x: parseInt(cell_selection.getAttribute('x')),
        y: parseInt(cell_selection.getAttribute('y'))
    }

    // get string of current guess
    let guess = get_text(selection.y)

    if (UI.cells[selection.y].filter(cell => cell.value === '').length > 0) {
        // show missing chars error
        UI.cells[selection.y].filter(cell => cell.value === '').forEach(cell => {
            cell.classList.add('error')
            setTimeout(() => cell.classList.remove('error'), 500)
        })
    } else if (!lexicon.includes(guess)) {
        // not a real word
        UI.cells[selection.y].forEach(cell => {
            cell.classList.add('error')
            setTimeout(() => cell.classList.remove('error'), 500)
        })
    } else {
        // valid guess
        // deselect cell
        cell_selection.blur()

        // check if won
        if (guess === word) {
            // game won
            cell_selection = null
            gameover = true

            // set status message
            UI.message_text.textContent = UI.messages.won.main
            UI.message_solution.textContent = UI.messages.won.span.replace('%i', selection.y + 1)
            UI.message.className = 'won'
        } else if (selection.y == guesses - 1) {
            // game lost
            cell_selection = null
            gameover = true

            // set status message
            UI.message_text.textContent = UI.messages.lost.main
            UI.message_solution.textContent = UI.messages.lost.span.replace('%w', word)
            UI.message.className = 'lost'
        } else {
            // move to next row
            UI.cells[selection.y].forEach(cell => {
                cell.setAttribute('enabled', false)
                cell.disabled = true
            })
            UI.cells[selection.y + 1].forEach(cell => {
                cell.setAttribute('enabled', true)
                cell.disabled = false
            })
            cell_selection = UI.cells[selection.y + 1][0]
            cell_selection.focus()
        }

        // highlight previous row
        // copy of the word to keep track of letters that have been flagged
        // consider following scenario: word = "monkey", guess = "doodle"
        // the first letter o is valid, the second shouldn't be flagged as "wrong position"
        // since the o only appears once.
        // this trackkeeping helps with that, as every "taken" letter gets replaced by a "-" 
        let word_checklist = word

        // first pass, mark all as invalid
        UI.cells[selection.y].forEach(cell => {
            if (!cell.getAttribute('value')) cell.setAttribute('value', 0)
        })

        // second pass, mark correct letters
        for (let i = 0; i < word.length; i++) {
            let char_original = word_checklist.charAt(i)
            let char_guess = guess.charAt(i)

            if (char_guess == char_original) {
                // char is correct
                UI.cells[selection.y][i].setAttribute('value', '2')

                // flag char in word_checklist as taken (replace with -)
                let index = word_checklist.split('').findIndex(char => char === char_guess)
                word_checklist = word_checklist.split('')
                word_checklist[index] = '-'
                word_checklist = word_checklist.join('')

                // flag char in guess as checked
                guess = guess.split('')
                guess[i] = '-'
                guess = guess.join('')
            }
        }

        // third pass, highlight all non-included
        for (let i = 0; i < word.length; i++) {
            let char_guess = guess.charAt(i)

            // if char left in word and char not already checked
            if (word_checklist.includes(char_guess) && char_guess != '-') {
                // char in word, wrong position
                UI.cells[selection.y][i].setAttribute('value', '1')

                // flag char in word_checklist as taken (replace with -)
                let index = [...word_checklist].findIndex(char => char === char_guess)
                word_checklist = [...word_checklist]
                word_checklist[index] = '-'
                word_checklist = word_checklist.join('')
            }
        }

        // highlight keyboard chars
        UI.cells[selection.y].forEach(cell =>
            document.querySelectorAll('keyboard char[value="-1"], keyboard char[value="0"], keyboard char[value="1"]').forEach(el_char => {
                if (el_char.textContent === cell.value && ['-1', '0', '1'].includes(el_char.getAttribute('value'))) el_char.setAttribute('value', cell.getAttribute('value'))
            })
        )
    }
}

// get string from row
function get_text(y) {
    return UI.cells[y].reduce((a, b) => a + b.value, '')
}

// return a random element from an array
Array.prototype.random = function () {
    return this[Math.floor(Math.random() * this.length)]
}

// return a random word from the wordlist
function random_word() {
    return Object.values(wordlist).random().random()
}

// reset button
document.querySelector('#reset').addEventListener('click', () => reset())

// start
setup()