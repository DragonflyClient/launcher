export default interface Edition {
    identifier: string
    title: string
    version: string
    minecraftVersion: string
    optifineVersion: string
    description: string
    tags: string[]
    injectionHook: string
}