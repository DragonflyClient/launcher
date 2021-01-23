export default interface VersionConfiguration {
    assets: string
    logging: {
        client: {
            file: {
                id: string
            }
        }
    }
    libraries: [
        {
            name: string
            downloads?: {
                classifiers?: {
                    "natives-windows"?: {
                        path: string
                    }
                }
            }
        }
    ]
}
