export type Account = MojangAccount | MicrosoftAccount

export interface MojangAccount {
    type: "mojang"
    accessToken: string
    clientToken: string
    profile: MinecraftProfile
}

export interface MicrosoftAccount {
    type: "microsoft"
    accessToken: string
    refreshToken: string
    profile: MinecraftProfile
}

export interface MinecraftProfile {
    uuid: string
    username: string
}

export interface AccountList {
    [accountId: string]: Account
}

export interface AccountsFile {
    accounts: AccountList
    currentSelectedAccount?: string
}