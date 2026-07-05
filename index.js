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
                const storeRes = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=fr`);
                if (storeRes.data?.[appid]?.success) {
                    const data = storeRes.data[appid].data;
                    gameName = data.name;
                    
                    if (data.price_overview) {
                        price = data.price_overview.final_formatted || (data.price_overview.final / 100).toFixed(2).replace('.', ',') + " €";
                    } else if (data.is_free) {
                        price = "Gratuit";
                    }

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

        // ====================== /SEARCH ======================
        if (interaction.commandName === 'search') {
            const query = interaction.options.getString('nom').trim();
            await interaction.deferReply();

            try {
                const res = await axios.get(`https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(query)}`);
                if (res.data && res.data.length > 0) {
                    const desc = res.data.slice(0, 15).map(j => `**${j.name}** — \`${j.appid}\``).join('\n');
                    const embed = new EmbedBuilder()
                        .setColor(0x00ff88)
                        .setTitle(`🔎 Résultats pour "${query}"`)
                        .setDescription(desc)
                        .setFooter({ text: "Utilise /game <AppID>" });
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply({ content: `❌ Aucun résultat pour "${query}"` });
                }
            } catch {
                await interaction.editReply({ content: "❌ Erreur de recherche." });
            }
        }

        // ====================== /FIX ======================
        if (interaction.commandName === 'fix') {
            const embed = new EmbedBuilder()
                .setColor(0xff9900)
                .setTitle("🔧 Online-Fix")
                .setDescription("Cherche un fix online pour ton jeu")
                .addFields(
                    { name: "🌐 Site", value: "[https://online-fix.me/](https://online-fix.me/)" },
                    { name: "🔑 Mot de passe ZIP", value: "`online-fix.me`" }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Aller sur Online-Fix")
                    .setStyle(ButtonStyle.Link)
                    .setURL("https://online-fix.me/")
            );

            await interaction.reply({ embeds: [embed], components: [row] });
        }

        // ====================== /TUTO ======================
        if (interaction.commandName === 'tuto') {
            const embed = new EmbedBuilder()
                .setColor(0x00ff88)
                .setTitle("📖 Tutoriel Complet SteamTools")
                .setDescription("Voici comment utiliser **SteamTools** étape par étape :")
                .addFields(
                    { name: "1️⃣ Téléchargement", value: "Utilise `/dl`" },
                    { name: "2️⃣ Installation", value: "• Décompresse le ZIP\n• Lance **SteamTools.exe en tant qu'administrateur**" },
                    { name: "3️⃣ Placement du .lua", value: "• Utilise `/game <AppID>`\n• Glisse le `.lua` sur le logo SteamTools\n• Clique droit → Relancer Steam" },
                    { name: "4️⃣ Installation du jeu", value: "• Attends que Steam s'ouvre\n• Va dans ta **Bibliothèque**\n• Installe ton jeu normalement" },
                    { name: "⚠️ Astuces", value: "• Toujours lancer en administrateur\n• Jeux récents → Fares.top" }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("📥 SteamTools")
                    .setStyle(ButtonStyle.Link)
                    .setURL("https://steamtools.net/download")
            );

            await interaction.reply({ embeds: [embed], components: [row] });
        }

        // ====================== /ADDFIX ======================
        if (interaction.commandName === 'addfix') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return interaction.reply({ content: "❌ Réservé aux modérateurs.", ephemeral: true });
            }
            const appid = interaction.options.getString('appid').trim();
            const nom = interaction.options.getString('nom');
            const note = interaction.options.getString('note') || 'Aucune';

            db.prepare('INSERT OR REPLACE INTO online_fix (appid, name, note) VALUES (?, ?, ?)').run(appid, nom, note);
            await interaction.reply({ content: `✅ ${nom} ajouté avec fix online.`, ephemeral: true });
        }

    } catch (error) {
        console.error(error);
        const msg = "❌ Une erreur est survenue.";
        if (interaction.deferred) await interaction.editReply({ content: msg });
        else await interaction.reply({ content: msg, ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
