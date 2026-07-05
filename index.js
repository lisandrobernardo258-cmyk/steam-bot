require('dotenv').config();

const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionsBitField 
} = require('discord.js');

const axios = require('axios');
const Database = require('better-sqlite3');

const db = new Database('steamtools.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS online_fix (
        appid TEXT PRIMARY KEY,
        name TEXT,
        note TEXT
    );
`);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    { name: 'game', description: 'Récupère le .lua pour un jeu', options: [{ name: 'appid', description: 'AppID Steam du jeu', type: 3, required: true }] },
    { name: 'search', description: 'Recherche des jeux par nom', options: [{ name: 'nom', description: 'Nom du jeu', type: 3, required: true }] },
    { name: 'fix', description: 'Cherche un fix online' },
    { name: 'tuto', description: 'Tutoriel complet pour utiliser SteamTools' },
    { 
        name: 'addfix', 
        description: 'Ajoute un jeu avec fix (Modérateurs seulement)', 
        options: [
            { name: 'appid', description: 'AppID', type: 3, required: true },
            { name: 'nom', description: 'Nom du jeu', type: 3, required: true },
            { name: 'note', description: 'Note optionnelle', type: 3, required: false }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Bot prêt !');
    } catch (error) {
        console.error(error);
    }
})();

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        // ====================== /GAME ======================
        if (interaction.commandName === 'game') {
            const appid = interaction.options.getString('appid').trim();
            await interaction.deferReply();

            let gameName = "Jeu Steam";
            let price = "Prix non disponible";
            let genre = "Non disponible";

            try {
                const storeRes = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appid}`);
                if (storeRes.data?.[appid]?.success) {
                    const data = storeRes.data[appid].data;
                    gameName = data.name;
                    
                    // Prix en Euros
                    if (data.price_overview) {
                        price = data.price_overview.final_formatted || 
                               (data.price_overview.final / 100) + " €";
                    } else if (data.is_free) {
                        price = "Gratuit";
                    }

                    // Genre
                    if (data.genres && data.genres.length > 0) {
                        genre = data.genres.map(g => g.description).join(", ");
                    }
                }
            } catch (e) {}

            const hasFix = db.prepare('SELECT * FROM online_fix WHERE appid = ?').get(appid);

            const embed = new EmbedBuilder()
                .setColor(0x00ff88)
                .setTitle(`🎮 ${gameName}`)
                .setDescription(`**AppID :** \`${appid}\``)
                .addFields(
                    { name: "💰 Prix", value: price, inline: true },
                    { name: "🎮 Genre", value: genre, inline: true },
                    { name: "📋 Instructions", value: "1. Clique sur Générer le .lua\n2. Colle l'AppID\n3. Télécharge ton fichier" },
                    { name: "🔗 Générateurs .lua", value: "1. ManifestHub\n2. Fares.top" },
                    { name: "⚠️ Attention", value: "Si le jeu est trop récent, utilise Fares.top." }
                );

            const buttons = [
                new ButtonBuilder().setLabel("📥 ManifestHub").setStyle(ButtonStyle.Link).setURL("https://ssmg4.github.io/ManifestHubDownloader/"),
                new ButtonBuilder().setLabel("📥 Fares.top").setStyle(ButtonStyle.Link).setURL("https://fares.top/")
            ];

            if (hasFix) {
                buttons.push(new ButtonBuilder().setLabel("🔧 Online-Fix").setStyle(ButtonStyle.Link).setURL(`https://online-fix.me/?search=${encodeURIComponent(gameName)}`));
            }

            const row = new ActionRowBuilder().addComponents(buttons);

            if (hasFix) {
                const fixEmbed = new EmbedBuilder()
                    .setColor(0xff9900)
                    .setTitle("✅ Fix Online Disponible")
                    .setDescription(`**${hasFix.name}** a un patch online.`);
                await interaction.editReply({ embeds: [embed, fixEmbed], components: [row] });
            } else {
                await interaction.editReply({ embeds: [embed], components: [row] });
            }
        }

        // Autres commandes (inchangées)
        if (interaction.commandName === 'search') { /* ... */ }
        if (interaction.commandName === 'fix') { /* ... */ }
        if (interaction.commandName === 'tuto') { /* ... */ }
        if (interaction.commandName === 'addfix') { /* ... */ }

    } catch (error) {
        console.error(error);
        const msg = "❌ Une erreur est survenue.";
        if (interaction.deferred) await interaction.editReply({ content: msg });
        else await interaction.reply({ content: msg, ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
