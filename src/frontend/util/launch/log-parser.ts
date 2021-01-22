// @ts-ignore
import xml2js from "xml2js"
import { chomp, chunksToLinesAsync } from "@rauschma/stringio"
import { ipcRenderer } from "electron"

import GameObject from "./game-object"

export default class LogParser {
    private xml: string

    constructor(private xmlParser: xml2js.Parser, private gameObject: GameObject) {
    }

    async readStdout(stream: NodeJS.ReadableStream) {
        for await (const line of chunksToLinesAsync(stream as AsyncIterable<string>)) {
            this.parseMessage(chomp(line), "DEBUG", "STDOUT")
        }
    }

    async readStderr(stream: NodeJS.ReadableStream) {
        for await (const line of chunksToLinesAsync(stream as AsyncIterable<string>)) {
            this.parseMessage(chomp(line), "ERROR", "STDERR")
        }
    }

    parseMessage(data: string, defaultLevel: string, defaultLogger: string) {
        try {
            if (!data || !data.toString()) return
            if (this.collectLines(data.toString())) return

            const { gameObject, xml } = this
            console.log(xml)

            this.xmlParser.parseString(xml, function(_error: unknown, result: any) {
                let message
                if (result) {
                    const event = result["log4j:Event"]
                    const { level, logger, thread, timestamp } = event["$"]

                    message = { level, logger, thread, timestamp, message: event["log4j:Message"][0] }
                } else {
                    message = {
                        level: defaultLevel,
                        logger: defaultLogger,
                        thread: "",
                        timestamp: new Date().getTime(),
                        message: xml,
                    }
                }

                ipcRenderer.send("game-output-data", { message, pid: gameObject.pid })
            })
        } catch (e) {
        }
    }

    collectLines(string: string) {
        if (string.indexOf("<log4j:Event") !== -1) {
            this.xml = string
            return true
        } else if (string.indexOf("<log4j:Message>") !== -1) {
            this.xml += string
            return true
        } else if (string.indexOf("</log4j:Event>") !== -1) {
            this.xml += string
        } else {
            this.xml = string
        }
    }
}