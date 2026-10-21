"""S¹ · the year's inks (plan 261). Each season dresses the round-9 print: what it
lists here replaces the hour's own ink, everything it leaves out stays
as the owner picked it. Autumn is the print as built (it was always
autumn: cosmos, pampas, the geese, the autumn moon), with its maples.

Per hour, keyed as the print's own tables are:
  h     the scene's inks (scene_f9.HOURS)
  sea   the bay's (scene_f6.SEA)
  pine, boat, train, bridge, cloud   el7's and scene_f5's tables
  and the season's own: the snow on Fuji (`snow`: the share of the
  mountain under it), the tint of the hills' woods (`crowns`), the
  bank's flowers, what falls, what flies."""

SEASONS = ('spring', 'summer', 'autumn', 'winter')
HOURS = ('dawn', 'day', 'dusk', 'night')

# the views (題箋): the hour as each season names it
VIEWS = {
    'spring': {'dawn': '春曙', 'day': '花霞', 'dusk': '帰雁', 'night': '朧月'},
    'summer': {'dawn': '凱風', 'day': '雲峰', 'dusk': '夕凪', 'night': '蛍'},
    'autumn': {'dawn': '曙', 'day': '帰帆', 'dusk': '落雁', 'night': '秋月'},
    'winter': {'dawn': '寒暁', 'day': '雪晴', 'dusk': '暮雪', 'night': '寒月'},
}
VIEWS_FR = {
    'spring': {'dawn': 'l’aube de printemps', 'day': 'la brume des cerisiers', 'dusk': 'les oies qui repartent', 'night': 'la lune voilée'},
    'summer': {'dawn': 'le vent du sud', 'day': 'les nuages d’orage', 'dusk': 'le calme du soir', 'night': 'les lucioles'},
    'autumn': {'dawn': 'l’aube', 'day': 'les voiles', 'dusk': 'les oies', 'night': 'la lune d’automne'},
    'winter': {'dawn': 'l’aube froide', 'day': 'le ciel après la neige', 'dusk': 'la neige du soir', 'night': 'la lune d’hiver'},
}

P = {s: {h: {} for h in HOURS} for s in SEASONS}

# ── 春 spring: 春はあけぼの. Haze, cherries, the hills' first green ────

P['spring']['dawn'] = dict(
    h=dict(
        sky=[(0, '#251f4a'), (0.22, '#3b3366'), (0.42, '#6f5b8f'), (0.54, '#a9809f'), (0.66, '#dca3ad'),
             (0.8, '#efc2bb'), (0.92, '#f6d8cc'), (1, '#faeadd')],
        band='#16123a', text='#1f1636', text_soft='#3a2f52',
        fuji=dict(fuji_top='#3f3060', fuji_mid='#5c4878', fuji_foot='#a888a8', fuji_shade='#221640', fuji_ridge='#2a1d46',
                  snow='#fbe9ee', snow_lit='#f5b9c4', snow_shade='#c4a7c8', fuji_mist='#f2cfd2'),
        mist=('#f6d6d6', '#efc8cc'), hill_far='#4d4466', hill_near='#2f2a45',
        water=('#9184a6', '#524a6c'), ripple='#f6d0c6', ground='#15111f', stem='#3a3048', plume='#f2d8cc',
        birds=None, boat='fisher', leaves=False, smoke=True,
    ),
    sea=dict(far='#bfa0b8', near='#433b5e', wave='#ffe2d8', wall='#26222f', wet='#f2c4b8',
             shade=('#131019', '#2a243b'), lit='#5c4c66', fog=('#f9dcd8', '#f1ccd0')),
    cloud=dict(top='#f1d8e8', mid='#c6a0c4', bottom='#8f73a8', op=0.82),
    clouds_at='thin',
    bridge='#3a3150',
    snow=0.31, crowns=(['#d9a7bf', '#c890b2', '#e9c4d4'], 0.3, 0.85),
    bloom=('#f7dfe9', '#e5b6cb', '#a5809f'), bark='#2a2030',
    bank='nanohana', falls='petals', flies=None,
)
P['spring']['day'] = dict(
    h=dict(
        sky=[(0, '#2f5a98'), (0.14, '#3f6ba7'), (0.4, '#7c9fcb'), (0.66, '#b7cde2'), (0.86, '#e6ecef'), (1, '#f7f1ee')],
        band='#20457d', text='#172748', text_soft='#33466b',
        fuji=dict(fuji_top='#3a5a8a', fuji_mid='#5574a4', fuji_foot='#a3b4cf', fuji_shade='#1f3a66', fuji_ridge='#264372',
                  snow='#ffffff', snow_lit='#fdfaf8', snow_shade='#cdd5e8', fuji_mist='#f1eef2'),
        mist=('#fbf4f5', '#f1e8ee'), hill_far='#7e9b74', hill_near='#58804f',
        water=('#86b0d6', '#4c7fb0'), ripple='#eef4f9', ground='#29462a', stem='#4a7044', plume='#f4ecd8',
        birds='gulls', boat='sails', leaves=False,
    ),
    sea=dict(far='#c4d8ea', near='#3d70a3', wave='#ffffff', wall='#54493f', wet='#eef5fa',
             shade=('#202a24', '#3a4b40'), lit='#958677', fog=('#fdf3f6', '#f3e4ec')),
    cloud=dict(top='#ffffff', mid='#fbf3f5', bottom='#dcd5e4', op=0.94),
    bridge='#5f7f52',
    snow=0.3, crowns=(['#f4cfdc', '#efbccf', '#fae4ec'], 0.38, 0.92),
    bloom=('#fff1f5', '#f6cbda', '#e19ab7'), bark='#4a3a36',
    bank='nanohana', falls='petals', flies='swallows',
)
P['spring']['dusk'] = dict(
    h=dict(
        sky=[(0, '#1b2650'), (0.14, '#283767'), (0.36, '#46508a'), (0.5, '#7f75a6'), (0.6, '#bf9db8'),
             (0.72, '#e6b7b0'), (0.85, '#f0c3a0'), (0.93, '#f2cba2'), (1, '#f6dab2')],
        band='#101a40', text='#141b33', text_soft='#303955',
        fuji=dict(fuji_top='#323b60', fuji_mid='#424c74', fuji_foot='#77748f', fuji_shade='#161b32', fuji_ridge='#182039',
                  snow='#f8eef0', snow_lit='#f8d4d0', snow_shade='#b9b6d0', fuji_mist='#d8b2b6'),
        mist=('#f0cbc0', '#dcb8c0'), hill_far='#2e3b56', hill_near='#1f2b3f',
        birds='geese_away', boat='sail_dark', leaves=False,
    ),
    sea=dict(far='#a796ad', near='#252f4a', fog=('#efcbc4', '#cfb3c2')),
    cloud=dict(top='#76698f', mid='#a888a8', bottom='#f2b8a0', op=0.85),
    snow=0.3, crowns=(['#b48aa0', '#9c7a94', '#c69cb0'], 0.32, 0.8),
    bloom=('#f4d2d9', '#d9a6b8', '#7d6788'), bark='#1c1a26',
    bank='nanohana', falls='petals', flies=None,
)
P['spring']['night'] = dict(
    h=dict(
        sky=[(0, '#0d1230'), (0.2, '#161d40'), (0.5, '#212a54'), (0.75, '#313d6c'), (0.9, '#465284'), (1, '#566290')],
        band='#070a22', stars=14, text='#f3ede2', text_soft='#dcd4c8',
        disc_fill=('#fcf2d6', '#e8d8b2'), disc_glow='#f2e6c8', glow_op=0.5, halo_glow=0.6,
        fuji=dict(fuji_top='#1d2541', fuji_mid='#27304f', fuji_foot='#3d4a70', fuji_shade='#0d1228', fuji_ridge='#101830',
                  snow='#dfe4f0', snow_lit='#eef0f8', snow_shade='#98a2c0', fuji_mist='#4a5680'),
        mist=('#8a92b8', '#717aa4'), hill_far='#1a2240', hill_near='#121a32',
        water=('#2a3760', '#172443'), ground='#090c18',
        birds=None, boat='isaribi', leaves=False, village=True,
    ),
    sea=dict(far='#46557f', near='#121c36', fog=('#7a84ac', '#636e98')),
    oboro=True,
    snow=0.3, crowns=(['#5f5a7c', '#6c6488', '#544f70'], 0.3, 0.75),
    bloom=('#efdce8', '#c4a6c0', '#56496c'), bark='#0f0e18',
    bank='nanohana', falls='petals', flies=None, lanterns=True,
)

# ── 夏 summer: 夏は夜. Red Fuji at dawn, the cloud peaks, fireflies ──────

P['summer']['dawn'] = dict(
    h=dict(
        sky=[(0, '#1c3266'), (0.22, '#2c4c86'), (0.42, '#5a7fb2'), (0.56, '#93afd0'), (0.7, '#c8d3dc'),
             (0.82, '#ecd6bf'), (0.92, '#f5d3a9'), (1, '#f8dfb8')],
        band='#13244e', text='#15213f', text_soft='#2f3d5e',
        fuji=dict(fuji_top='#7a2a1e', fuji_mid='#a8432a', fuji_foot='#c9845a', fuji_shade='#4a1610', fuji_ridge='#5a1c14',
                  snow='#fbf0e6', snow_lit='#fde3cf', snow_shade='#d9b8a8', fuji_mist='#efd2b4'),
        mist=('#f4ddc8', '#ecd2c2'), hill_far='#3f5a4a', hill_near='#263e30',
        water=('#7f9fbf', '#3f5f86'), ripple='#f6dcc4', ground='#0f1c14', stem='#2d4a32', plume='#efe0c8',
        birds=None, boat='fisher', leaves=False, smoke=False,
    ),
    sea=dict(far='#b8b4c4', near='#304a6e', wave='#ffe6d4', wall='#232a2a', wet='#f0c4aa',
             shade=('#0f1513', '#24312a'), lit='#4f5a4a', fog=('#f6dccb', '#efd0c4')),
    cloud=dict(top='#fff6ee', mid='#f4dcd2', bottom='#c7a9b8', op=0.9),
    clouds_at='mackerel',
    bridge='#2c3f34',
    snow=0.035, crowns=None,
    bank='hydrangea', falls=None, flies='egrets',
)
P['summer']['day'] = dict(
    h=dict(
        sky=[(0, '#123a80'), (0.14, '#1c4a94'), (0.4, '#4a82c2'), (0.66, '#92b9df'), (0.86, '#cfe2f1'), (1, '#edf3f2')],
        band='#0c2b66', text='#10203f', text_soft='#22355a',
        fuji=dict(fuji_top='#24395f', fuji_mid='#344f7c', fuji_foot='#7d95b8', fuji_shade='#121f3c', fuji_ridge='#1a2a4c',
                  snow='#ffffff', snow_lit='#ffffff', snow_shade='#c9d4e6', fuji_mist='#dfe9ef'),
        mist=('#eef4f6', '#e2ecf0'), hill_far='#4c8a58', hill_near='#2c6a3a',
        water=('#4a96d2', '#1f62a4'), ripple='#e6f2fb', ground='#163c22', stem='#2f5a34', plume='#e8e0c0',
        birds='gulls', boat='sails', leaves=False,
    ),
    sea=dict(far='#9fcdf0', near='#1f5c9c', wave='#ffffff', wall='#4c443d', wet='#e2f2fc',
             shade=('#16241c', '#2b4434'), lit='#8a7c70', fog=('#f2f7f9', '#e4eef3')),
    cloud=dict(top='#ffffff', mid='#f4f8fc', bottom='#bccde2', op=0.97),
    bridge='#3f6a42', thunderhead=True,
    snow=0.03, crowns=(['#1f5a2c', '#2a6e36'], 0.25, 0.7),
    bank='hydrangea', falls=None, flies=None,
)
P['summer']['dusk'] = dict(
    h=dict(
        sky=[(0, '#171b46'), (0.14, '#25295d'), (0.36, '#463f7e'), (0.5, '#80609a'), (0.6, '#bd7690'),
             (0.72, '#e88e72'), (0.85, '#f4a866'), (0.93, '#f6b974'), (1, '#f8cf98')],
        band='#0e1036', text='#12102c', text_soft='#211e37',
        fuji=dict(fuji_top='#2c2f58', fuji_mid='#3c3f6a', fuji_foot='#76688a', fuji_shade='#141630', fuji_ridge='#181a38',
                  snow='#f6ece8', snow_lit='#f8d6c4', snow_shade='#b4b2cc', fuji_mist='#d8a8a0'),
        mist=('#efc0a8', '#d8a8a8'), hill_far='#28394a', hill_near='#1a2a32',
        water=('#6a5f86', '#2a2f52'), ground='#0b1214',
        birds='egrets', boat='sail_dark', leaves=False,
    ),
    sea=dict(far='#a98aa0', near='#232848', fog=('#ecc0aa', '#c9a2ae')),
    cloud=dict(top='#5e4f82', mid='#9a6a90', bottom='#f2a070', op=0.85),
    snow=0.035, crowns=None,
    bank='hydrangea', falls=None, flies='fireflies_few',
)
P['summer']['night'] = dict(
    h=dict(
        sky=[(0, '#030915'), (0.2, '#071427'), (0.5, '#0d223d'), (0.75, '#163556'), (0.9, '#1f4468'), (1, '#284f74')],
        band='#01040f', stars=36,
        fuji=dict(fuji_top='#13203a', fuji_mid='#1b2a46', fuji_foot='#2e4466', fuji_shade='#080f20', fuji_ridge='#0b1428',
                  snow='#c9d4e4', snow_lit='#dbe3ee', snow_shade='#8494b0', fuji_mist='#36507a'),
        hill_far='#11223a', hill_near='#0b1828', ground='#050c0e',
        birds=None, boat='isaribi', leaves=False, village=True,
    ),
    snow=0.035, crowns=None,
    bank='hydrangea', falls=None, flies='fireflies',
)

# ── 秋 autumn: 秋は夕暮れ. The print as built, and its maples ───────────

P['autumn']['dawn'] = dict(crowns=(['#9c4f55', '#b46a58', '#8a4a5c', '#c0805e'], 0.5, 0.8),
                           maple=('#d0583e', '#a63a30', '#6e2a36'), bank='cosmos', falls=None)
P['autumn']['day'] = dict(crowns=(['#c4532f', '#d97f30', '#d4a33b', '#b0402c'], 0.55, 0.92),
                          maple=('#e2552c', '#c23a24', '#8c2a20'), bank='cosmos', falls='leaves')
P['autumn']['dusk'] = dict(h=dict(text_soft='#29334f'),  # a step deeper: the desk's fare line read 4.4:1
                           crowns=(['#7a3f43', '#8f5040', '#6a3a44', '#9a6046'], 0.5, 0.75),
                           maple=('#b8483a', '#8a3030', '#4a2230'), bank='cosmos', falls='leaves')
P['autumn']['night'] = dict(crowns=(['#2c2836', '#352c38', '#3a3040'], 0.45, 0.7),
                            maple=('#4a2a36', '#3a2230', '#22161e'), bank='cosmos', falls=None)
for _h in HOURS:
    P['autumn'][_h].update(snow=0.27, maple_tree=True)

# ── 冬 winter: 冬はつとめて. Snow on everything, the cold moon ──────────

P['winter']['dawn'] = dict(
    h=dict(
        sky=[(0, '#1b2448'), (0.22, '#2c3a64'), (0.42, '#566a92'), (0.56, '#8e9cb8'), (0.68, '#c3c3cc'),
             (0.8, '#ead4c0'), (0.92, '#f5dcb8'), (1, '#f8e8cc')],
        band='#111836', text='#171d34', text_soft='#33394f',
        fuji=dict(fuji_top='#3c3558', fuji_mid='#5a5076', fuji_foot='#a492ae', fuji_shade='#211a38', fuji_ridge='#281f40',
                  snow='#fbf1ee', snow_lit='#f6c4b4', snow_shade='#b9b4cc', fuji_mist='#efd4cc'),
        mist=('#f2dcd4', '#e6d0d0'), hill_far='#8a8ca8', hill_near='#5e6380',
        water=('#8d90a8', '#4c5070'), ripple='#f4d8cc', ground='#b4b8cc', stem='#6e6a80', plume='#d8d0cc',
        birds='cranes', boat='fisher', leaves=False, smoke=True,
    ),
    sea=dict(far='#b6aec0', near='#40445e', wave='#ffe2d6', wall='#2a2a36', wet='#f2c8bc',
             shade=('#16161f', '#2c2c3c'), lit='#e9dce0', fog=('#f4ddd6', '#ead2d2')),
    cloud=dict(top='#f4e4dc', mid='#c9b6c0', bottom='#8e8aa4', op=0.85),
    bridge='#9a98b0', train_roof='#ece0e4',
    snow=0.5, crowns='snow', crown_ink='#3a3a52', cap='#f2e6e8', cap_shade='#b8b2c8',
    bank='camellia', falls=None, flies=None,
)
P['winter']['day'] = dict(
    h=dict(
        sky=[(0, '#0f3876'), (0.14, '#1f4f92'), (0.4, '#5b8cc6'), (0.66, '#a7c7e6'), (0.86, '#e2edf5'), (1, '#f3f6f7')],
        band='#0a2a60', text='#132447', text_soft='#2e4268',
        fuji=dict(fuji_top='#2a4a80', fuji_mid='#4468a0', fuji_foot='#9fb4d2', fuji_shade='#14305c', fuji_ridge='#1b3868',
                  snow='#ffffff', snow_lit='#ffffff', snow_shade='#c4d2e8', fuji_mist='#eaf0f5'),
        mist=('#f5f8fa', '#e9eff4'), hill_far='#b9c6d8', hill_near='#8e9db6',
        water=('#5f8cbc', '#2c5a8e'), ripple='#eaf2fa', ground='#e6ebf2', stem='#7a8494', plume='#e6e2da',
        birds='gulls', boat='sails', leaves=False,
    ),
    sea=dict(far='#bcd3ea', near='#2a5a90', wave='#ffffff', wall='#5a5550', wet='#eef6fc',
             shade=('#4a5464', '#6a7a8e'), lit='#f6f8fa', fog=('#f6f9fb', '#e8eef3')),
    cloud=dict(top='#ffffff', mid='#f6f9fc', bottom='#c9d6e6', op=0.96),
    bridge='#d6dde6', train_roof='#ffffff',
    snow=0.52, crowns='snow', crown_ink='#2c3e40', cap='#ffffff', cap_shade='#c6d2e2',
    bank='camellia', falls=None, flies=None,
)
P['winter']['dusk'] = dict(
    h=dict(
        sky=[(0, '#262b46'), (0.14, '#353b5c'), (0.36, '#4e5476'), (0.5, '#6c6e8e'), (0.6, '#8e8aa2'),
             (0.72, '#aca2b2'), (0.85, '#c4b6bc'), (0.93, '#cfc0c2'), (1, '#d8cac8')],
        band='#1a1e36', text='#101326', text_soft='#1f2338',
        disc_glow='#ece4d4', glow_op=0.28, halo_glow=0.32,
        fuji=dict(fuji_top='#6a6c88', fuji_mid='#7c7e98', fuji_foot='#a6a6ba', fuji_shade='#4a4c68', fuji_ridge='#545670',
                  snow='#e6e6ee', snow_lit='#eeeef4', snow_shade='#b4b6c8', fuji_mist='#c4c0cc'),
        mist=('#d2ccd6', '#c4bfcc'), hill_far='#9a9cb2', hill_near='#767a94',
        water=('#7a7c94', '#3e4260'), ripple='#d6d0d8', refl='#ece6dc', refl_op=0.4,
        ground='#a6abbf', stem='#5a5a6e', plume='#c8c4cc',
        birds=None, boat='fisher', leaves=False, smoke=True,
    ),
    sea=dict(far='#a6a4b8', near='#3c405a', wave='#e6e2ea', wall='#2c2e3c', wet='#d0ccd8',
             shade=('#1c1e2a', '#33364a'), lit='#d8d8e2', fog=('#d6d2dc', '#c8c4d2')),
    cloud=dict(top='#b4b0c0', mid='#9a96aa', bottom='#8a8498', op=0.7),
    bridge='#8a8ca2', train_roof='#c9c8d4',
    snow=0.5, crowns='snow', crown_ink='#4a4c60', cap='#d4d2dc', cap_shade='#9a9aae',
    bank='camellia', falls='snow', flies=None,
)
P['winter']['night'] = dict(
    h=dict(
        sky=[(0, '#030817'), (0.2, '#08132b'), (0.5, '#102347'), (0.75, '#1b3664'), (0.9, '#26467a'), (1, '#2f528a')],
        band='#01040f', stars=70, text='#eef0f2', text_soft='#bcc2cc',
        disc_fill=('#fbfcff', '#dfe6f0'), disc_glow='#e6eef8', glow_op=0.42,
        fuji=dict(fuji_top='#1a2846', fuji_mid='#243556', fuji_foot='#3e5480', fuji_shade='#0c1428', fuji_ridge='#101a32',
                  snow='#e4ecf8', snow_lit='#f2f6fc', snow_shade='#90a4c8', fuji_mist='#40567e'),
        mist=('#7e92b6', '#6a7ea6'), hill_far='#4a5a7e', hill_near='#34425f',
        water=('#21365c', '#122340'), ground='#5a6a8c', stem='#2a3448', plume='#a8b4c8',
        birds=None, boat='none', leaves=False, village=True,
    ),
    sea=dict(far='#3c5884', near='#0f1a30', wall='#0e1626', wet='#a8bcd8', lit='#9fb2d0'),
    bridge='#4a5878', train_roof='#9fb0cc',
    snow=0.5, crowns='snow', crown_ink='#1a2438', cap='#b9c8e2', cap_shade='#6a7ca0',
    bank='camellia', falls=None, flies=None,
)
