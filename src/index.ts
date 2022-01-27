import readline from "readline"
import { homedir } from "os"
import fs from "fs"
const stdin = process.stdin,
    stdout = process.stdout

readline.emitKeypressEvents(stdin)
stdin.setRawMode(true)
stdin.setEncoding("utf-8")

let HIGHSCORE: number

if (fs.existsSync(`${homedir()}/.snakeHighscore`))
    HIGHSCORE = Number(
        fs.readFileSync(`${homedir()}/.snakeHighscore`).toString()
    )
else HIGHSCORE = 0

const COLUMN_COUNT = 100,
    ROW_COUNT = 30,
    MS_PER_FRAME = 1000 / 15,
    OPPOSITE_DIRECTIONS: {
        [key: string]: Direction
    } = {
        up: "down",
        down: "up",
        left: "right",
        right: "left",
    }

const bold = (text: string) => `\x1b[1m${text}\x1b[0m`

if (stdout.columns < COLUMN_COUNT || stdout.rows < ROW_COUNT) {
    console.log(bold(`Your terminal is too small. Please resize it to at least ${COLUMN_COUNT} columns and ${ROW_COUNT} rows.`))
    process.exit()
}

const board: CellState[][] = Array(ROW_COUNT)
    .fill(null)
    .map(() => Array(COLUMN_COUNT).fill("empty")),
    snake: Snake = {
        body: [
            {
                x: 0,
                y: 0,
            },
        ],
        direction: "right",
        score: 0,
    }

let food: Location = {
    x: Math.floor(Math.random() * COLUMN_COUNT),
    y: Math.floor(Math.random() * ROW_COUNT),
},
    superfood: Location | undefined,
    paused = false,
    gameQuit = false

const renderBoard = () => {
    stdout.write("\x1Bc")
    let output = ""
    for (const [y, row] of board.entries()) {
        for (const [x, cell] of row.entries()) {
            switch (cell) {
                case "empty":
                    output += "⬞"
                    break
                case "snake":
                    output += "\x1b[36m" // (cyan)
                    const lastSnakeCell = snake.body[snake.body.length - 1]
                    if (lastSnakeCell.x === x && lastSnakeCell.y === y) {
                        switch (snake.direction) {
                            case "right":
                                output += ">"
                                break
                            case "left":
                                output += "<"
                                break
                            case "up":
                                output += "^"
                                break
                            case "down":
                                output += "v"
                        }
                    } else output += "#"
                    output += "\x1b[0m" // (reset)
                    break
                case "food":
                    output += "\x1b[33mo\x1b[0m" // (yellow)o(reset)
                    break
                case "superfood":
                    output += "\x1b[31mO\x1b[0m" // (red)O(reset)
                    break
            }
        }
        output += "\n"
    }
    stdout.write(output)
    stdout.write(
        `${bold("Score")}: ${snake.score} | ${bold("Highscore")}: ${snake.score > HIGHSCORE ? snake.score : HIGHSCORE
        }\n`
    )
    stdout.write(
        paused
            ? `${bold("PAUSED")} | ${bold("Unpause")}: Space\n`
            : `${bold("Movement")}: WSAD, Arrows, VIM keys | ${bold(
                "Quit"
            )}: CTRL+q, CTRL+d, q | ${bold("Pause")}: Space\n`
    )
}

const quit = (reason: "quit" | "lost") => {
    gameQuit = true
    stdout.write("\x1Bc")
    if (reason === "quit") {
        stdout.write(`${bold("Thanks for playing!")}\n`)
    } else {
        stdout.write(`${bold("Game over!")}\n`)
    }

    stdout.write(`${bold("Overall score")}: ${snake.score}\n`)

    if (snake.score > HIGHSCORE) {
        stdout.write(`${bold("New highscore!")}\n`)
        fs.writeFileSync(`${homedir()}/.snakeHighscore`, String(snake.score))
    } else if (!fs.existsSync(`${homedir()}/.snakeHighscore`))
        fs.writeFileSync(`${homedir()}/.snakeHighscore`, String(snake.score))

    process.exit()
}

const trySpawnFood = (type: "food" | "superfood") => {
    const randomX = Math.floor(Math.random() * COLUMN_COUNT),
        randomY = Math.floor(Math.random() * ROW_COUNT)

    if (!snake.body.some((cell) => cell.x === randomX && cell.y === randomY)) {
        if (type === "food") {
            board[randomY][randomX] = "food"
            food = {
                x: randomX,
                y: randomY,
            }
        } else {
            board[randomY][randomX] = "superfood"
            superfood = {
                x: randomX,
                y: randomY,
            }
        }
    } else {
        trySpawnFood(type)
    }
}

const keyQueue: string[] = []

stdin.on("keypress", (char, key) => {
    if (char === "\x03" || char === "\x04" || key.name === "q")
        // ctrl-c, ctrl-d or q
        quit("quit")
    if (key.name === "space") {
        paused = !paused
    } else if (!paused) keyQueue.push(key.name)
})

const updateBoard = () => {
    board.forEach((row) => row.fill("empty"))

    board[food.y][food.x] = "food"

    if (superfood) board[superfood.y][superfood.x] = "superfood"

    snake.body.forEach((cell) => (board[cell.y][cell.x] = "snake"))
}

const handleKey = (key: string) => {
    if (["w", "up", "k"].includes(key))
        snake.direction = "up"
    else if (["s", "down", "j"].includes(key))
        snake.direction = "down"
    else if (["a", "left", "h"].includes(key))
        snake.direction = "left"
    else if (["d", "right", "l"].includes(key))
        snake.direction = "right"
}

const tick = () => {
    if (gameQuit) return
    updateBoard()
    renderBoard()

    const oldDirection = snake.direction

    handleKey(keyQueue.shift() || snake.direction)

    if (!paused) {
        if (OPPOSITE_DIRECTIONS[snake.direction] === oldDirection && snake.body.length > 1)
            snake.direction = oldDirection

        switch (snake.direction) {
            case "right":
                let newXRight = snake.body[snake.body.length - 1].x + 1
                if (newXRight >= COLUMN_COUNT) newXRight = 0
                snake.body.push({
                    x: newXRight,
                    y: snake.body[snake.body.length - 1].y,
                })
                break
            case "left":
                let newXLeft = snake.body[snake.body.length - 1].x - 1
                if (newXLeft < 0) newXLeft = COLUMN_COUNT - 1
                snake.body.push({
                    x: newXLeft,
                    y: snake.body[snake.body.length - 1].y,
                })
                break
            case "up":
                let newYUp = snake.body[snake.body.length - 1].y - 1
                if (newYUp < 0) newYUp = ROW_COUNT - 1
                snake.body.push({
                    x: snake.body[snake.body.length - 1].x,
                    y: newYUp,
                })
                break
            case "down":
                let newYDown = snake.body[snake.body.length - 1].y + 1
                if (newYDown >= ROW_COUNT) newYDown = 0
                snake.body.push({
                    x: snake.body[snake.body.length - 1].x,
                    y: newYDown,
                })
                break
        }

        const newHead = snake.body[snake.body.length - 1]

        if (food.x === newHead.x && food.y === newHead.y) {
            trySpawnFood("food")
            if (Math.random() > 0.7 && !superfood) trySpawnFood("superfood")
            snake.score++
        } else if (
            superfood &&
            superfood.x === newHead.x &&
            superfood.y === newHead.y
        ) {
            snake.score += 3
            superfood = undefined
        } else if (board[newHead.y][newHead.x] === "snake") quit("lost")
        else snake.body.shift()
    } else {
    }

    if (snake.direction === "up" || snake.direction === "down")
        setTimeout(tick, MS_PER_FRAME * 1.75)
    else setTimeout(tick, MS_PER_FRAME)
}

tick()

type CellState = "empty" | "snake" | "food" | "superfood"
type Direction = "up" | "down" | "left" | "right"
interface Location {
    x: number
    y: number
}
interface Snake {
    body: Location[]
    direction: Direction
    score: number
}
