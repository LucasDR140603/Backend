import jwt from 'jsonwebtoken'
import {pool} from './conexion.js'
export function comprobarClave(str){
    let notrim=str
    str=str.replace(/ /g, "")
    return notrim==str && str.length>=8 && str.toUpperCase()!=str && str.toLowerCase()!=str && /\d/.test(str) && /[^a-zA-Z0-9\s]/.test(str)
}
export function adaptar(result){
    result.rows=result.rows.length>0?result.rows.map(row=>
        Object.fromEntries(
            Object.entries(row).map(([key,value])=>[
                key,
                (key.toLowerCase()=='inicio' || key.toLowerCase()=='fin') && value!=null && new Date(value).toISOString().includes(".")?
                formatFecha(value):
                value
            ])
        )
    ):[]
    return result
}
export function formatFecha(fecha){
    if (fecha==null)return null
    let value=new Date(fecha)
    return `${value.getFullYear()}-${(value.getMonth()+1).toString().padStart(2,'0')}-${value.getDate().toString().padStart(2,'0')}T${value.getHours().toString().padStart(2,'0')}:${value.getMinutes().toString().padStart(2,'0')}`
}
export function formatFecha2(fecha){
    if (fecha==null)return null
    let value=new Date(fecha)
    return `${value.getDate().toString().padStart(2,'0')}/${(value.getMonth()+1).toString().padStart(2,'0')}/${value.getFullYear()} ${value.getHours().toString().padStart(2,'0')}:${value.getMinutes().toString().padStart(2,'0')}`
}

export function jwtear(x){
    const payload={
        id:x.id,
    }
    delete x.clave
    delete x.pais
    const token=jwt.sign(payload,process.env.JWT_SECRET,{expiresIn:'15m'})
    const refreshToken=jwt.sign(payload,process.env.JWT_SECRET_REFRESH)
    return {usuario:x,token:token,refreshToken:refreshToken}
}
export function authenticate(req,res,next){
    const authHeader=req.headers['authorization']
    const token=authHeader && authHeader.split(' ')[1]
    if (token==null){return res.sendStatus(401)}
    jwt.verify(token,process.env.JWT_SECRET,async(err,user)=>{
        if (err) return res.status(401).json({error:'TOKEN_EXPIRED'})
        let result=await pool.query('select id,administrador from usuarios where id=$1 and operativo=true;',[user.id])
        if (result.rows.length==0) return res.status(403).json('Usuario no encontrado o no disponible')
        req.user=result.rows[0]
        next()
    })
}
export function authenticate_email(req,res,next){
    const authHeader=req.headers['authorization']
    const token=authHeader && authHeader.split(' ')[1]
    if (token==null){return res.sendStatus(403)}
    jwt.verify(token,process.env.JWT_SECRET,async(err,user)=>{
        if (err) return res.status(401).json({error:'TOKEN_EXPIRED'})
        let result=await pool.query('select * from usuarios where lower(email)=$1 and operativo=true;',[user.email.toLowerCase()])
        if (result.rows.length==0) return res.status(403).json('Usuario no econtrado o no disponible')
        req.user={...user}
        next()
    })
}
export function admin(req,res,next){
    if (!req.user || (!req.user.administrador && req.method!=='GET')){
        return res.status(403).json({error:'ACCESS_DENIED'})
    }
    next()
}