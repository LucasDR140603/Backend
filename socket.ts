import jwt from 'jsonwebtoken'
import { pool } from './conexion.ts'
let io:Server | null
import {Server,type Socket} from 'socket.io'
import { parseCookie } from 'cookie'
import http from 'http'
function getToken(socket:Socket){
    const cookieHeader=socket.handshake.headers.cookie
    if (cookieHeader){
        const cookies=parseCookie(cookieHeader)
        if (cookies.token) return cookies.token
    }
    return socket.handshake.auth?.token || null
}
export function initSocket(server:http.Server){
    io=new Server(server,{
        path:"/webapi/socket.io",
        transports: ['websocket'],
        pingTimeout:5000,
        pingInterval: 5000,
        cors:{
            origin:['https://www.asinova.es', 'http://localhost:3000','http://localhost:4000'],
            credentials:true
        }
    })
    io.use((socket,next)=>{
        const token=getToken(socket)
        if (!token){
            return next(new Error('NO_AUTORIZADO'))
        }
        try{
            jwt.verify(token,process.env.JWT_SECRET!,async(err:jwt.VerifyErrors | null,user:any)=>{
                if (err) return next(new Error("TOKEN_INVÁLIDO"))
                let result=await pool.query('select id,administrador from usuarios where id=$1 and operativo=true;',[user.id])
                if (result.rows.length==0) return next(new Error("Usuario no encontrado o no disponible"))
                socket.user=result.rows[0]
                next()
            })
        }catch(err){
            next(new Error("TOKEN_INVÁLIDO"))
        }
    })
    io.on("connection",(socket)=>{
        socket.join(socket.user.id)
        if (socket.user.administrador){
            socket.join("administradores")
        }
        socket.on('error',(err)=>{
            console.log(`ERROR: ${err}`)
            socket.disconnect()
        })
    })
    return io
}
export function getIO():Server{
    if (!io){
        throw new Error("Socket.IO no se inicializó aún")
    }
    return io
}