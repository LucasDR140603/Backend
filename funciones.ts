import jwt from 'jsonwebtoken'
import {pool} from './conexion.js'
import { type Request,type Response,type NextFunction } from 'express'
import {type QueryResult,type QueryResultRow} from 'pg'
export function comprobarClave(str:string){
    let notrim=str
    str=str.replace(/ /g, "")
    return notrim==str && str.length>=8 && str.toUpperCase()!=str && str.toLowerCase()!=str && /\d/.test(str) && /[^a-zA-Z0-9\s]/.test(str)
}
export function adaptar(result:QueryResult<QueryResultRow>):QueryResult<QueryResultRow>{
    result.rows=result.rows.length>0?result.rows.map((row:any)=>
        Object.fromEntries(
            Object.entries(row).map(([key,value])=>[
                key,
                (key.toLowerCase()=='inicio' || key.toLowerCase()=='fin') && value!=null && new Date(value.toString()).toISOString().includes(".")?
                formatFecha(value.toString()):
                value
            ])
        )
    ):[]
    return result
}
export function formatFecha(fecha:Date | string){
    if (fecha==null)return null
    let value=new Date(fecha)
    return `${value.getFullYear()}-${(value.getMonth()+1).toString().padStart(2,'0')}-${value.getDate().toString().padStart(2,'0')}T${value.getHours().toString().padStart(2,'0')}:${value.getMinutes().toString().padStart(2,'0')}`
}
export function formatFecha2(fecha:Date | string){
    if (fecha==null)return null
    let value=new Date(fecha)
    return `${value.getDate().toString().padStart(2,'0')}/${(value.getMonth()+1).toString().padStart(2,'0')}/${value.getFullYear()} ${value.getHours().toString().padStart(2,'0')}:${value.getMinutes().toString().padStart(2,'0')}`
}

export function jwtear(x:Record<string,any>){
    const payload={
        id:x.id,
    }
    delete x.clave
    delete x.pais
    const token=jwt.sign(payload,process.env.JWT_SECRET!,{expiresIn:'15m'})
    const refreshToken=jwt.sign(payload,process.env.JWT_SECRET_REFRESH!,{expiresIn:'7d'})
    return {usuario:x,token:token,refreshToken:refreshToken}
}
export function authenticate(req:Request,res:Response,next:NextFunction){
    const authHeader=req.headers['authorization']
    const token=req.cookies?.token || (authHeader && authHeader.split(' ')[1])
    if (token==null){return res.sendStatus(401)}
    jwt.verify(token,process.env.JWT_SECRET!,async(err:jwt.VerifyErrors | null,user:any)=>{
        if (err || !user.id) return res.status(401).json({error:'TOKEN_EXPIRED'})
        let result=await pool.query('select id,administrador from usuarios where id=$1 and operativo=true;',[user.id])
        if (result.rows.length==0) return res.status(403).json('Usuario no encontrado o no disponible')
        req.user=result.rows[0]
        next()
    })
}
export function authenticate_email(req:Request,res:Response,next:NextFunction){
    const authHeader=req.headers['authorization']
    const token=authHeader && authHeader.split(' ')[1]
    if (token==null){return res.sendStatus(403)}
    jwt.verify(token,process.env.JWT_SECRET!,async(err:jwt.VerifyErrors | null,user:any)=>{
        if (err || !user.email) return res.status(401).json({error:'TOKEN_EXPIRED'})
        let result=await pool.query('select * from usuarios where lower(email)=$1 and operativo=true;',[user.email.toLowerCase()])
        if (result.rows.length==0) return res.status(403).json('Usuario no econtrado o no disponible')
        req.user={...user}
        next()
    })
}
export function admin(req:Request,res:Response,next:NextFunction){
    if (!req.user || (!req.user.administrador && req.method!=='GET')){
        return res.status(403).json({error:'ACCESS_DENIED'})
    }
    next()
}