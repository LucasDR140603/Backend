import jwt from 'jsonwebtoken'
import { pool } from './conexion.js'
let io
import {Server} from 'socket.io'
export function initSocket(server){
    io=new Server(server,{
        path:"/webapi/socket.io",
        transports: ['websocket'],
        pingTimeout:5000,
        pingInterval: 5000,
        cors:{
            origin:"*"
        }
    })
    io.use((socket,next)=>{
        const token=socket.handshake.auth.token
        if (!token){
            return next(new Error('NO_AUTORIZADO'))
        }
        try{
            jwt.verify(token,process.env.JWT_SECRET,async(err,user)=>{
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
export function getIO(){
    if (!io){
        throw new Error("Socket.IO no se inicializó aún")
    }
    return io
}