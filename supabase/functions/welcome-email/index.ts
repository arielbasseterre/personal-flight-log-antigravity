import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const PDF_URL = "https://mexnmpbpqtccaulekupo.supabase.co/storage/v1/object/sign/guia/FlightLog_Guia_Usuario.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMWFlYjExMS03NDk0LTQzOGItYWJhNy0wMDQ4NWRlMTJhNDMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJndWlhL0ZsaWdodExvZ19HdWlhX1VzdWFyaW8ucGRmIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4MjAyMzM2NCwiZXhwIjoxMTI0MjgyMzM2NH0.zvjW8ktswkOPuNOgZkezC-o-Ce_Q3URBziE-U5VCt-I"

// Helper to convert Uint8Array to base64
function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  try {
    const { type, record } = await req.json()
    // Solo enviar en INSERT en la tabla profiles
    if (type !== "INSERT") {
      return new Response("ok")
    }

    const email = record.email
    const firstName = record.first_name || "Piloto"

    if (!email) {
      return new Response("No email found in record", { status: 400 })
    }

    // Descargar el PDF
    console.log("Descargando la guía del usuario en PDF...")
    const pdfResponse = await fetch(PDF_URL)
    if (!pdfResponse.ok) {
      throw new Error(`Error al descargar el PDF: ${pdfResponse.statusText}`)
    }
    const pdfBuffer = await pdfResponse.arrayBuffer()
    const base64Pdf = uint8ArrayToBase64(new Uint8Array(pdfBuffer))

    console.log(`Enviando correo de bienvenida a ${email}...`)
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Personal Flight Log <onboarding@resend.dev>",
        to: [email],
        subject: "¡Bienvenido a Personal Flight Log! ✈️",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2563eb; margin-bottom: 20px;">¡Hola, ${firstName}!</h2>
            <p>Te damos una cálida bienvenida a <strong>Personal Flight Log</strong>, tu plataforma profesional para el registro y control de horas de vuelo.</p>
            <p>A partir de ahora podrás llevar un control detallado de tus actividades, sincronizar datos y mucho más.</p>
            <p>Adjunto a este correo encontrarás la <strong>Guía del Usuario</strong> en formato PDF, la cual te ayudará a dar tus primeros pasos y sacarle el máximo provecho a la aplicación.</p>
            <p>Si tienes alguna consulta o necesitas soporte, no dudes en escribirnos.</p>
            <br/>
            <p>¡Buenos vuelos!</p>
            <p style="font-size: 0.9em; color: #64748b;">El equipo de Personal Flight Log</p>
          </div>
        `,
        attachments: [
          {
            filename: "FlightLog_Guia_Usuario.pdf",
            content: base64Pdf,
          }
        ]
      }),
    })

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text()
      throw new Error(`Error de Resend: ${errorText}`)
    }

    console.log("Correo enviado con éxito.")
    return new Response("ok")
  } catch (error: any) {
    console.error("Error en welcome-email function:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
