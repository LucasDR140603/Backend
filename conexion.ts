import {Pool,Client,types} from 'pg'
import { getIO } from './socket.ts'
import 'dotenv/config'
types.setTypeParser(1700, function(val) {
    return val === null ? null : parseFloat(val);
});
const datos_conexion={
    host:process.env.DB_HOST || 'localhost',
    user:'postgres',
    port:5432,
    password:process.env.PASSWORD!.replaceAll(`'`,''),
    database:'grp'
}
export const pool=new Pool(datos_conexion)
const client=new Client(datos_conexion)
export async function iniciar_listener(){
    await client.connect();
    await client.query('listen cambios')
    client.on('notification',async(msg)=>{
        let {tabla,operacion,datos}=JSON.parse(msg.payload!);
        console.log('--- NUEVO CAMBIO DETECTADO ---');
        console.log(`Tabla: ${tabla}`);
        console.log(`Operación: ${operacion}`);
        const io=getIO()
        let destino:typeof io | ReturnType<typeof io.to>=io
        if (['registros','usuarios'].includes(tabla)){
            destino=destino.to('administradores')
            if (tabla=='registros'){
                const sockets=await io.fetchSockets()
                if (sockets.filter((x)=>x.rooms.has(datos.id_usuario) && x.rooms.has('administradores')).length==0){
                    destino=destino.to(datos.id_usuario)
                }
            }
            else{
                if (!datos.administrador){
                    io.in(datos.id).socketsLeave('administradores')
                    destino=destino.to(datos.id)
                }
                else{
                    io.in(datos.id).socketsJoin('administradores')
                }
            }
        }
        console.log('Datos:', datos);
        destino.emit(operacion.toLowerCase()+"-"+tabla,datos)
    })
}