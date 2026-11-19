import 'dotenv/config'
import express, { type CookieOptions } from 'express'
import cors from 'cors'
import http from 'http'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import {comprobarClave,authenticate,admin,jwtear,authenticate_email} from './funciones.ts'
import {parsePhoneNumberFromString} from 'libphonenumber-js'
import crypto from 'crypto'
import {pool,iniciar_listener} from './conexion.ts'
import clientes from './routes/Clientes.ts'
import centros from './routes/Centros.ts'
import proyectos from './routes/Proyectos.ts'
import registros from './routes/Registros.ts'
import usuarios from './routes/Usuarios.ts'
import axios from 'axios'
import nodemailer from 'nodemailer'
import { initSocket } from './socket.ts'
import {rateLimit} from 'express-rate-limit'
import cookieParser from 'cookie-parser'
const app=express()
const port=process.env.port || 8081
const email_config={
    host:'smtp.gmail.com',
    port:587,
    secure:false,
    auth:{
        user:'asinovasolutions@gmail.com',
        pass:process.env.EMAIL_PASS!.replaceAll(`'`,'')
    }
}
app.use(cookieParser())
const cookieOptions:CookieOptions={
    httpOnly:true,
    secure:process.env.NODE_ENV!=='development',
    sameSite:'lax'
}
app.use(cors({
    origin:['https://www.asinova.es','http://localhost:3000','http://localhost:4000'],
    credentials:true,
    methods:['GET','POST','PUT','DELETE'],
    allowedHeaders:['Content-Type','X-register-key','Authorization'],
}))
app.use(express.json({limit:'100mb'}))
app.use(express.urlencoded({limit:'100mb',extended:true}))
app.set('trust proxy',1)
const api:string='/webapi/'
const globalLimiter=rateLimit({
    windowMs:15*60*1000,
    limit:99,
    skipSuccessfulRequests:true,
    message:{error:'Demasiados intentos desde esta IP. Espera 15 minutos'}
})
const strictLimiter=rateLimit({
    windowMs:15*60*1000,
    limit:5,
    skipSuccessfulRequests:true,
    requestWasSuccessful:(req,res)=>req.path!=`${api}gmail` && res.statusCode<400,
    message:{error:'Demasiados intentos desde esta IP. Espera 15 minutos'},
})
app.use(api,globalLimiter)
const server:http.Server=http.createServer(app)
initSocket(server)
iniciar_listener()
app.get(api,async(req,res)=>{
    res.json('Conexión')
})
app.post(`${api}register`,strictLimiter,async(req,res)=>{
    const key=req.headers['x-register-key']
    if (!key || key!=process.env.REGISTER_KEY){
        return res.status(403).json(!key?'Falta la contraseña de registro':'Contraseña de registro incorrecta')
    }
    const clave=req.body.clave
    if (!comprobarClave(clave)){
        return res.status(403).json('Contraseña no válida')
    }
    const numero=parseInt((await pool.query('select count(*) as numero from Usuarios')).rows[0].numero)
    if (numero>0){
        const claves=(await pool.query(`select clave from Usuarios`)).rows
        const comparaciones=claves.map((x:any)=>bcrypt.compare(req.body.clave,x.clave))
        const repeticiones=await Promise.all(comparaciones)
        if (repeticiones.includes(true)){
            return res.status(403).json('Contraseña repetida')
        }
    }
    const administrador=numero==0
    const x=req.body
    x.administrador=administrador
    const id=x.id || crypto.randomUUID()
    x.id=id
    x.operativo=true
    const hash=await bcrypt.hash(x.clave,10)
    x.telefono=parsePhoneNumberFromString(x.telefono,x.pais || null)!.number
    await pool.query(`insert into usuarios (id,nombre,apellido1,apellido2,nick,clave,email,telefono,administrador)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
            x.id,
            x.nombre,
            x.apellido1,
            x.apellido2 || null,
            x.nick,
            hash,
            x.email,
            x.telefono,
            x.administrador
        ]
    )
    x.perfil=null
    const resultado=jwtear(x)
    const navegador=!!req.headers.origin
    if (navegador){
        res.cookie('token',resultado.token,{...cookieOptions!,maxAge:1000*60*15})
        res.cookie('refreshToken',resultado.refreshToken,{...cookieOptions,maxAge:1000*60*60*24*7})
    }
    res.json(navegador?resultado.usuario:resultado)
})
app.post(`${api}login`,strictLimiter,async(req,res)=>{
    const user=req.body
    let result=await pool.query(`select * from usuarios where (LOWER(nick)=$1 or LOWER(email)=$1) and operativo=true;`,[user.user.toLowerCase()])
    if (result.rows.length>0 && await bcrypt.compare(user.clave,result.rows[0].clave)){
        let usuario=result.rows[0]
        const resultado=jwtear(usuario)
        const navegador=!!req.headers.origin
        if (navegador){
            res.cookie('token',resultado.token,{...cookieOptions,maxAge:1000*60*15})
            res.cookie('refreshToken',resultado.refreshToken,{...cookieOptions,maxAge:1000*60*60*24*7})
        }
        res.json(navegador?resultado.usuario:resultado)
    }
    else{
        res.sendStatus(403)
    }
})
app.post(`${api}usuario`,authenticate,async(req,res)=>{
    let result=await pool.query(`select * from usuarios where id=$1 and operativo=true`,[req.user!.id])
    if (result.rows.length>0){
        let usuario=result.rows[0]
        delete usuario.clave
        res.json(usuario)
    }
    else{
        res.status(401).json({error:'USER_NO_LONGER_OPERATIVE'})
    }
})
app.post(`${api}refresh`,async(req,res)=>{
    const refreshToken=req.cookies?.refreshToken || req.body.refreshToken
    if (!refreshToken) return res.sendStatus(401)
    jwt.verify(refreshToken,process.env.JWT_SECRET_REFRESH!,async(err:jwt.VerifyErrors | null,user:any)=>{
        if (err) return res.sendStatus(403)
        let result=await pool.query('select * from usuarios where id=$1 and operativo=true;',[user.id])
        if (result.rows.length==0){
            return res.status(403).json('Usuario no encontrado o no disponible')
        }
        else{
            const payload={
                id:user.id,
            }
            const newToken=jwt.sign(payload,process.env.JWT_SECRET!,{expiresIn:'15m'})
            const navegador=!!req.headers.origin
            if (navegador){
                res.cookie('token',newToken,{...cookieOptions,maxAge:1000*60*15})
                res.sendStatus(204)
            }
            else{
                res.json({token:newToken})
            }
        }
    })
})
app.post(`${api}gmail`,strictLimiter,async(req,res)=>{
    try{
        const response=await axios.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            new URLSearchParams({
                secret:process.env.TURNSTILE_SECRET!,
                response:req.body.captchaToken
            }),
            {
                headers:{
                    'Content-Type':'application/x-www-form-urlencoded'
                }
            }
        )
        if (!response.data.success){
            return res.status(400).json({error:'Captcha inválido'})
        }
    }
    catch(e){
        return res.status(500).json('Error verificando captcha')
    }
    const transporter=nodemailer.createTransport(email_config)
    const mailOptions={
        from:email_config.auth.user,
        to:'jorge.guinarte@asinova.es',
        subject:req.body.asunto,
        text:req.body.mensaje
    }
    await transporter.sendMail(mailOptions)
    res.json({mensaje:'Correo enviado correctamente'})
})
function hmac(str:string){
    return crypto.createHmac('sha256',process.env.JWT_SECRET!).update(str).digest('hex')
}
app.post(`${api}recuperar`,strictLimiter,async(req,res)=>{
    const transporter=nodemailer.createTransport(email_config)
    const user=req.body.user
    let result=await pool.query('select id,email from usuarios where (lower(nick)=$1 or lower(email)=$1) and operativo=true;',[user.toLowerCase()])
    if (result.rows.length>0){
        const cod=(Math.floor(Math.random()*10000)+"").padStart(4,'0')
        const mailOptions={
            from:email_config.auth.user,
            to:result.rows[0].email,
            subject:'Código de Recuperación',
            text:cod
        }
        await transporter.sendMail(mailOptions)
        const payload={
            email:result.rows[0].email,
            codigo:hmac(cod)
        }
        const codigo=jwt.sign(payload,process.env.JWT_SECRET!,{expiresIn:'15m'})
        res.json({token:codigo,email:result.rows[0].email})
    }
    else{
        res.sendStatus(403)
    }
})
app.post(`${api}comprobar`,strictLimiter,authenticate_email,async(req,res)=>{
    if (req.user && req.user?.codigo && crypto.timingSafeEqual(Buffer.from(hmac(req.body.codigo)),Buffer.from(req.user.codigo))){
        const payload={
            email:req.user.email,
            comprobado:true
        }
        const token=jwt.sign(payload,process.env.JWT_SECRET!,{expiresIn:'15m'})
        res.json({token:token})
    }
    else{
        res.sendStatus(403)
    }
})
app.post(`${api}cambiarclave`,strictLimiter,authenticate_email,async(req,res)=>{
    if (req.user && req.user.comprobado){
        const claves=(await pool.query('select clave from usuarios where lower(email)!=$1',[req.user.email!.toLowerCase()])).rows
        if (claves.length>0){
            const comparaciones=claves.map((x:any)=>bcrypt.compare(req.body.clave,x.clave))
            var repeticiones=await Promise.all(comparaciones)
            if (repeticiones.includes(true)){
                return res.status(403).json("Contraseña repetida")
            }
        }
        await pool.query('update usuarios set clave=$1 where lower(email)=$2',[await bcrypt.hash(req.body.clave,10),req.user.email!.toLowerCase()])
        let result=await pool.query('select * from usuarios where lower(email)=$1;',[req.user.email!.toLowerCase()])
        const resultado=jwtear(result.rows[0])
        const navegador=!!req.headers.origin
        if (navegador){
            res.cookie('token',resultado.token,{...cookieOptions,maxAge:1000*60*15})
            res.cookie('refreshToken',resultado.refreshToken,{...cookieOptions,maxAge:1000*60*60*24*7})
        }
        res.json(navegador?resultado.usuario:resultado)
    }
    else{
        res.sendStatus(403)
    }
})
app.post(`${api}logout`,(req,res)=>{
    res.clearCookie('token')
    res.clearCookie('refreshToken')
    res.sendStatus(204)
})
app.use(`${api}perfiles`,express.static('uploads/perfiles'))
app.use(`${api}clientes`,authenticate,admin,clientes)
app.use(`${api}centros`,authenticate,admin,centros)
app.use(`${api}proyectos`,authenticate,admin,proyectos)
app.use(`${api}registros`,authenticate,registros)
app.use(`${api}usuarios`,authenticate,usuarios)
server.listen(port,()=>{
    console.log('Conectado')
})