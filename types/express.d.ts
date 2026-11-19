declare global{
    namespace Express{
        interface Request{
            user?:{
                id?:string,
                administrador?:boolean
                email?:string
                codigo?:string
                comprobado?:boolean
            }
        }
    }
}
export {}