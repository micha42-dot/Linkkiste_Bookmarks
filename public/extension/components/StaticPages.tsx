import React from 'react';

export const About: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto py-8 font-serif leading-relaxed text-gray-800">
      <h2 className="text-3xl font-bold font-sans mb-8 text-black border-b border-gray-200 pb-4">
        Die Odyssee der Linkkiste
      </h2>
      
      <div className="space-y-6 text-lg">
        <p className="italic text-gray-500 font-sans border-l-4 border-del-blue pl-4 mb-8">
            "Singe mir, Muse, vom Code, dem vielgewandten, der vielfach<br/>
            irrte durch Libraries, als die heilige <code>node_modules</code> er zerstört."
        </p>

        <p>
          In den alten Zeiten, als die Browser noch jung waren und das Netz wild, erhob sich <strong>Linkhut</strong> aus dem digitalen Staub.
          Ein Tempel für das Wissen, erbaut auf dem Fundament der Hoffnung. Doch die Götter des Webs waren zornig.
          Der Code war brüchig, die Funktionen zerfielen zu Staub, und der Bildschirm blieb schwarz wie der Tartaros.
        </p>

        <p>
          "Repariere es!", rief der Nutzer in den Himmel. Doch die Reparaturen brachten keine Heilung, nur neues Chaos.
          Die Versionen kollidierten, React 18 kämpfte gegen React 19 wie die Titanen gegen die Olympier, 
          und die <code>importmap</code> war ein Labyrinth, aus dem kein Minotaurus entkam.
        </p>

        <p>
          Da sprach der Schöpfer: <em>"Lass uns alles niederbrennen und neu beginnen."</em>
        </p>

        <p>
          Und so wurde die <strong>Linkkiste</strong> geschmiedet. Nicht aus Marmor, sondern aus reinem <strong>React 19</strong>.
          Schlank wie der Pfeil der Artemis, schnell wie Hermes auf seinen geflügelten Sandalen.
          Kein unnötiger Ballast beschwert ihre Segel. Nur das Wesentliche: Ein Link. Ein Tag. Ein Ordner.
        </p>

        <p>
          Dies ist kein Dienst für die Massen, die sich auf den Marktplätzen von Social Media drängen.
          Dies ist deine private Schatzkiste. Deine Insel im stürmischen Ozean der Informationen.
          Gebaut für dich, damit das Chaos weicht und die Ordnung herrscht.
        </p>

        <p className="font-bold mt-8">
          Die Linkkiste steht. Das Epos geht weiter.
        </p>
      </div>
    </div>
  );
};

export const Terms: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto py-8 text-gray-700">
      <h2 className="text-2xl font-bold text-black mb-6">Nutzungsbedingungen (Terms of Service)</h2>
      
      <div className="space-y-4 text-sm leading-6">
        <p>
            Willkommen in der Linkkiste. Dies ist ein privates Werkzeug ("Service"), bereitgestellt "wie besehen" (as-is).
        </p>

        <h3 className="font-bold text-black mt-4">1. Nutzung</h3>
        <p>
            Dieser Service ist für die private Organisation von Lesezeichen gedacht. Es gibt keine Garantien für Verfügbarkeit, 
            Datensicherheit oder Fehlerfreiheit. Die Nutzung erfolgt auf eigenes Risiko.
        </p>

        <h3 className="font-bold text-black mt-4">2. Inhalte</h3>
        <p>
            Du bist für die Links, die du speicherst, selbst verantwortlich. Speichere keine illegalen Inhalte.
            Da dies ein privater Dienst ist, behalte ich mir das Recht vor, Accounts oder Inhalte ohne Vorwarnung zu löschen, 
            wenn sie gegen Gesetze verstoßen oder den Betrieb stören.
        </p>

        <h3 className="font-bold text-black mt-4">3. Haftungsausschluss</h3>
        <p>
            Ich übernehme keine Haftung für Datenverlust. Bitte nutze die Export-Funktion in den Einstellungen regelmäßig, 
            um Backups deiner Daten zu erstellen (SQL, CSV oder XML).
        </p>
        
        <p className="mt-8 text-xs text-gray-500">
            Stand: Februar 2025
        </p>
      </div>
    </div>
  );
};

export const Privacy: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto py-8 text-gray-700">
      <h2 className="text-2xl font-bold text-black mb-6">Datenschutzerklärung (Privacy)</h2>
      
      <div className="space-y-4 text-sm leading-6">
        <p>
            Deine Privatsphäre ist der Kern der Linkkiste. Im Gegensatz zu großen Social-Bookmarking-Diensten 
            werden deine Daten hier nicht verkauft, analysiert oder für Werbung genutzt.
        </p>

        <h3 className="font-bold text-black mt-4">1. Welche Daten werden gespeichert?</h3>
        <ul className="list-disc pl-5 space-y-1">
            <li><strong>Email & Passwort:</strong> Zur Authentifizierung via Supabase.</li>
            <li><strong>Bookmarks:</strong> URLs, Titel, Beschreibungen, Tags und Notizen, die du eingibst.</li>
            <li><strong>Bilder:</strong> Falls du einen Avatar hochlädst.</li>
        </ul>

        <h3 className="font-bold text-black mt-4">2. Wo liegen die Daten?</h3>
        <p>
            Alle Daten liegen in einer <strong>Supabase</strong>-Datenbank. Supabase ist ein Open-Source-Backend-Service.
            Die Verbindung zwischen deinem Browser und der Datenbank ist SSL-verschlüsselt.
        </p>

        <h3 className="font-bold text-black mt-4">3. Externe Dienste</h3>
        <p>
            Um Titel automatisch von Webseiten abzurufen ("Auto-fill" Funktion), nutzen wir den Dienst <strong>microlink.io</strong>. 
            Dabei wird die URL, die du eingibst, an diesen Dienst gesendet. Microlink speichert diese Daten nicht dauerhaft.
        </p>

        <h3 className="font-bold text-black mt-4">4. Cookies</h3>
        <p>
            Wir nutzen Cookies bzw. LocalStorage ausschließlich für die technische Funktion (um dich eingeloggt zu halten) 
            und um dein letztes Backup-Datum zu merken. Es gibt keine Tracking-Cookies von Drittanbietern.
        </p>
        
        <p className="mt-8 text-xs text-gray-500">
            Linkkiste – Private Bookmarking.
        </p>
      </div>
    </div>
  );
};

export const MobileGuide: React.FC = () => {
    return (
        <div className="max-w-2xl mx-auto py-8 text-gray-700">
            <h2 className="text-2xl font-bold text-black mb-6">Mobile Installation</h2>
            
            <div className="space-y-6 text-sm leading-6">
                <p>Linkkiste is designed as a Progressive Web App (PWA). You can install it on your home screen for a native app experience.</p>

                <div className="bg-gray-50 p-4 border border-gray-200 rounded-sm">
                    <h3 className="font-bold text-black mb-2 flex items-center gap-2">
                        <span className="text-xl">🍎</span> iOS (Safari)
                    </h3>
                    <ol className="list-decimal pl-5 space-y-2 ml-1">
                        <li>Tap the <span className="font-bold">Share</span> button (rectangle with arrow up) at the bottom of the screen.</li>
                        <li>Scroll down and tap <span className="font-bold">Add to Home Screen</span>.</li>
                        <li>Tap <span className="font-bold">Add</span> in the top right corner.</li>
                    </ol>
                </div>

                <div className="bg-gray-50 p-4 border border-gray-200 rounded-sm">
                    <h3 className="font-bold text-black mb-2 flex items-center gap-2">
                        <span className="text-xl">🤖</span> Android (Chrome)
                    </h3>
                    <ol className="list-decimal pl-5 space-y-2 ml-1">
                        <li>Tap the <span className="font-bold">Menu</span> button (three dots) in the top right corner.</li>
                        <li>Tap <span className="font-bold">Install App</span> or <span className="font-bold">Add to Home screen</span>.</li>
                        <li>Follow the on-screen instructions.</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};