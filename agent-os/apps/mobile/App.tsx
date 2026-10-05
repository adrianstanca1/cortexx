import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  health,
  loadConnection,
  loadPresets,
  request,
  saveConnection,
  savePreset,
  type ConnectionPreset,
} from "./lib/api";

type Tab = "missions" | "agents" | "approvals" | "skills" | "delegations" | "groups" | "settings";
type Agent = {
  id: string; name: string; role: string; state: string; capabilities: string[];
  model?: string; runsCompleted?: number;
};
type Approval = { id: string; action: string; reason: string; status: string; createdAt: string };
type Skill = { id: string; name: string; description: string; category: string; version: string };
type InstalledSkill = { instanceId: string; skillId: string; state: string; enabledForAgents: string[]; definition?: Skill };
type Delegation = {
  id: string; task: string; fromAgent: string; toAgent: string; priority: string;
  status: string; approvalId?: string; result?: string;
};
type Group = { id: string; name: string; members: string[]; coordinator?: string; sharedMemory: boolean };
type Mission = { id: string; goal: string; status: string };

const TABS: { id: Tab; label: string }[] = [
  { id: "missions", label: "Missions" },
  { id: "agents", label: "Agents" },
  { id: "approvals", label: "Approvals" },
  { id: "skills", label: "Skills" },
  { id: "delegations", label: "Delegate" },
  { id: "groups", label: "Groups" },
  { id: "settings", label: "Connect" },
];

export default function MissionControl() {
  const [tab, setTab] = useState<Tab>("missions");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [url, setUrl] = useState(process.env.EXPO_PUBLIC_CORTEX_URL || "http://127.0.0.1:4310");
  const [token, setToken] = useState("");
  const [presetName, setPresetName] = useState("My Cortex");
  const [presets, setPresets] = useState<ConnectionPreset[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [installed, setInstalled] = useState<InstalledSkill[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [goal, setGoal] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentRole, setAgentRole] = useState("specialist");
  const [agentCaps, setAgentCaps] = useState("research");
  const [delegateTask, setDelegateTask] = useState("");
  const [delegateFrom, setDelegateFrom] = useState("supervisor");
  const [delegateTo, setDelegateTo] = useState("researcher");
  const [delegatePriority, setDelegatePriority] = useState("normal");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState("supervisor,researcher");

  const activeAgents = useMemo(
    () => agents.filter(agent => !["terminated", "offline"].includes(agent.state)),
    [agents],
  );

  async function refresh() {
    setBusy(true);
    try {
      const [m, a, ap, s, ins, d, g] = await Promise.all([
        request<Mission[]>("/api/missions"),
        request<Agent[]>("/api/agents"),
        request<Approval[]>("/api/approvals"),
        request<Skill[]>("/api/skills"),
        request<InstalledSkill[]>("/api/skills/installed"),
        request<Delegation[]>("/api/delegations"),
        request<Group[]>("/api/groups"),
      ]);
      setMissions(m); setAgents(a); setApprovals(ap); setSkills(s);
      setInstalled(ins); setDelegations(d); setGroups(g);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to refresh");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const connection = await loadConnection();
      setUrl(connection.url); setToken(connection.token);
      setPresets(await loadPresets());
      setReady(true);
      if (connection.token) await refresh();
    })();
  }, []);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      setNotice(success);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setBusy(true);
    try {
      await health(url);
      await saveConnection(url, token);
      setNotice("Connected securely");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <SafeAreaView style={s.root}><ActivityIndicator size="large" color="#7c9cff" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.h1}>Cortex Agent OS</Text>
          <Text style={s.muted}>{activeAgents.length} active agents · {approvals.filter(a => a.status === "pending").length} approvals</Text>
        </View>
        {busy ? <ActivityIndicator color="#7c9cff" /> : <TouchableOpacity onPress={refresh}><Text style={s.link}>Refresh</Text></TouchableOpacity>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs} contentContainerStyle={s.tabsInner}>
        {TABS.map(item => (
          <TouchableOpacity key={item.id} onPress={() => setTab(item.id)} style={[s.tab, tab === item.id && s.tabActive]}>
            <Text style={[s.tabText, tab === item.id && s.tabTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!!notice && <Text style={s.notice}>{notice}</Text>}

      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        {tab === "missions" && <>
          <Section title="Launch mission">
            <TextInput value={goal} onChangeText={setGoal} multiline placeholder="Give the agent team a goal…" placeholderTextColor="#687894" style={[s.input, s.multi]} />
            <Primary label="Launch" disabled={!goal.trim()} onPress={() => run(async () => {
              await request("/api/missions", { method: "POST", body: JSON.stringify({ goal }) });
              setGoal("");
            }, "Mission launched")} />
          </Section>
          <Section title="Recent missions">
            {missions.map(item => <Card key={item.id} title={item.goal} subtitle={item.status} />)}
          </Section>
        </>}

        {tab === "agents" && <>
          <Section title="Spawn governed agent">
            <TextInput value={agentName} onChangeText={setAgentName} placeholder="Agent name" placeholderTextColor="#687894" style={s.input} />
            <TextInput value={agentRole} onChangeText={setAgentRole} placeholder="Role" placeholderTextColor="#687894" style={s.input} />
            <TextInput value={agentCaps} onChangeText={setAgentCaps} placeholder="Capabilities, comma separated" placeholderTextColor="#687894" style={s.input} />
            <Primary label="Spawn agent" disabled={!agentName.trim()} onPress={() => run(async () => {
              await request("/api/agents", {
                method: "POST",
                body: JSON.stringify({
                  name: agentName,
                  role: agentRole,
                  capabilities: agentCaps.split(",").map(value => value.trim()).filter(Boolean),
                }),
              });
              setAgentName("");
            }, "Agent created")} />
          </Section>
          <Section title="Agent lifecycle">
            {agents.map(agent => (
              <View key={agent.id} style={s.card}>
                <View style={s.rowBetween}><Text style={s.cardTitle}>{agent.name}</Text><Status value={agent.state} /></View>
                <Text style={s.muted}>{agent.role} · {agent.capabilities.join(", ") || "no capabilities"} · runs {agent.runsCompleted || 0}</Text>
                <View style={s.actions}>
                  {agent.state === "suspended"
                    ? <Small label="Resume" onPress={() => run(() => request("/api/agents/" + encodeURIComponent(agent.id) + "/resume", { method: "POST" }), "Agent resumed")} />
                    : agent.state !== "terminated" && <Small label="Suspend" onPress={() => run(() => request("/api/agents/" + encodeURIComponent(agent.id) + "/suspend", { method: "POST" }), "Agent suspended")} />}
                  {agent.state !== "terminated" && <Small danger label="Terminate" onPress={() => run(() => request("/api/agents/" + encodeURIComponent(agent.id), { method: "DELETE" }), "Agent terminated")} />}
                </View>
              </View>
            ))}
          </Section>
        </>}

        {tab === "approvals" && <Section title="Governed approvals">
          {approvals.filter(item => item.status === "pending").length === 0 && <Text style={s.muted}>Nothing waiting.</Text>}
          {approvals.map(item => (
            <View key={item.id} style={s.card}>
              <Text style={s.cardTitle}>{item.action}</Text>
              <Text style={s.muted}>{item.reason}</Text>
              <Status value={item.status} />
              {item.status === "pending" && <View style={s.actions}>
                <Small label="Approve" onPress={() => run(() => request("/api/approvals/" + item.id, { method: "POST", body: JSON.stringify({ status: "approved" }) }), "Approved")} />
                <Small danger label="Reject" onPress={() => run(() => request("/api/approvals/" + item.id, { method: "POST", body: JSON.stringify({ status: "rejected" }) }), "Rejected")} />
              </View>}
            </View>
          ))}
        </Section>}

        {tab === "skills" && <>
          <Section title="Skill catalog">
            {skills.map(skill => {
              const item = installed.find(value => value.skillId === skill.id);
              return <View key={skill.id} style={s.card}>
                <Text style={s.cardTitle}>{skill.name}</Text>
                <Text style={s.muted}>{skill.description} · {skill.category} · v{skill.version}</Text>
                {!item
                  ? <Small label="Install manifest" onPress={() => run(() => request("/api/skills/" + encodeURIComponent(skill.id) + "/install", { method: "POST" }), "Skill installed")} />
                  : <Text style={s.ok}>Installed · {item.enabledForAgents.length} agents enabled</Text>}
              </View>;
            })}
          </Section>
          <Section title="Installed skills">
            {installed.map(item => <Card key={item.instanceId} title={item.definition?.name || item.skillId} subtitle={item.state + " · " + item.enabledForAgents.join(", ")} />)}
          </Section>
        </>}

        {tab === "delegations" && <>
          <Section title="Delegate specialist work">
            <TextInput value={delegateFrom} onChangeText={setDelegateFrom} placeholder="From agent id" placeholderTextColor="#687894" style={s.input} />
            <TextInput value={delegateTo} onChangeText={setDelegateTo} placeholder="To agent id" placeholderTextColor="#687894" style={s.input} />
            <TextInput value={delegatePriority} onChangeText={setDelegatePriority} placeholder="low | normal | high | critical" placeholderTextColor="#687894" style={s.input} />
            <TextInput value={delegateTask} onChangeText={setDelegateTask} multiline placeholder="Task to delegate" placeholderTextColor="#687894" style={[s.input, s.multi]} />
            <Primary label="Delegate" disabled={!delegateTask.trim()} onPress={() => run(async () => {
              await request("/api/delegations", {
                method: "POST",
                body: JSON.stringify({
                  task: delegateTask,
                  fromAgent: delegateFrom,
                  toAgent: delegateTo,
                  priority: delegatePriority,
                  requiresApproval: delegatePriority === "critical",
                }),
              });
              setDelegateTask("");
            }, delegatePriority === "critical" ? "Delegation sent for approval" : "Delegation completed")} />
          </Section>
          <Section title="Delegation history">
            {delegations.map(item => <Card key={item.id} title={item.task} subtitle={item.fromAgent + " → " + item.toAgent + " · " + item.priority + " · " + item.status} detail={item.result} />)}
          </Section>
        </>}

        {tab === "groups" && <>
          <Section title="Create agent group">
            <TextInput value={groupName} onChangeText={setGroupName} placeholder="Group name" placeholderTextColor="#687894" style={s.input} />
            <TextInput value={groupMembers} onChangeText={setGroupMembers} placeholder="Member ids, comma separated" placeholderTextColor="#687894" style={s.input} />
            <Primary label="Create shared-memory group" disabled={!groupName.trim()} onPress={() => run(async () => {
              const members = groupMembers.split(",").map(value => value.trim()).filter(Boolean);
              await request("/api/groups", {
                method: "POST",
                body: JSON.stringify({
                  name: groupName,
                  members,
                  coordinator: members[0],
                  sharedMemory: true,
                  consensusRequired: false,
                }),
              });
              setGroupName("");
            }, "Group created")} />
          </Section>
          <Section title="Teams">
            {groups.map(item => <Card key={item.id} title={item.name} subtitle={item.members.join(", ") + (item.coordinator ? " · coordinator " + item.coordinator : "")} />)}
          </Section>
        </>}

        {tab === "settings" && <Section title="Secure connection">
          <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" placeholder="https://agent.example.com" placeholderTextColor="#687894" style={s.input} />
          <TextInput value={token} onChangeText={setToken} autoCapitalize="none" secureTextEntry placeholder="Operator token" placeholderTextColor="#687894" style={s.input} />
          <Primary label="Connect" disabled={!url.trim() || token.length < 32} onPress={connect} />
          <Text style={s.label}>Preset name</Text>
          <TextInput value={presetName} onChangeText={setPresetName} placeholder="My VPS" placeholderTextColor="#687894" style={s.input} />
          <Small label="Save encrypted preset" onPress={() => run(async () => {
            await saveConnection(url, token);
            setPresets(await savePreset({ name: presetName || "Cortex", url, token }));
          }, "Preset saved in SecureStore")} />
          {presets.map(item => <TouchableOpacity key={item.name} style={s.card} onPress={async () => {
            setUrl(item.url); setToken(item.token); await saveConnection(item.url, item.token); setNotice("Preset selected: " + item.name);
          }}>
            <Text style={s.cardTitle}>{item.name}</Text><Text style={s.muted}>{item.url}</Text>
          </TouchableOpacity>)}
        </Section>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={s.section}><Text style={s.h2}>{title}</Text>{children}</View>;
}
function Card({ title, subtitle, detail }: { title: string; subtitle: string; detail?: string }) {
  return <View style={s.card}><Text style={s.cardTitle}>{title}</Text><Text style={s.muted}>{subtitle}</Text>{detail ? <Text style={s.detail}>{detail}</Text> : null}</View>;
}
function Primary({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[s.primary, disabled && s.disabled]}><Text style={s.primaryText}>{label}</Text></TouchableOpacity>;
}
function Small({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return <TouchableOpacity onPress={onPress} style={[s.small, danger && s.danger]}><Text style={s.smallText}>{label}</Text></TouchableOpacity>;
}
function Status({ value }: { value: string }) {
  return <Text style={[s.status, value === "completed" || value === "approved" || value === "idle" ? s.ok : null]}>{value}</Text>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#070b14" },
  header: { padding: 18, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  h1: { color: "#fff", fontSize: 26, fontWeight: "800" },
  h2: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 10 },
  muted: { color: "#93a4bd", fontSize: 12, lineHeight: 18 },
  link: { color: "#7c9cff", fontWeight: "700" },
  tabs: { maxHeight: 46 },
  tabsInner: { paddingHorizontal: 14, gap: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: "#0e1626" },
  tabActive: { backgroundColor: "#5d7cff" },
  tabText: { color: "#93a4bd", fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: "#fff" },
  notice: { color: "#b8c6e0", backgroundColor: "#101a2d", padding: 10, marginHorizontal: 16, borderRadius: 10 },
  body: { flex: 1 },
  bodyInner: { padding: 16, paddingBottom: 48 },
  section: { marginBottom: 18 },
  input: { color: "#fff", backgroundColor: "#0e1626", borderColor: "#1e2b44", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 9 },
  multi: { minHeight: 90, textAlignVertical: "top" },
  primary: { backgroundColor: "#5d7cff", padding: 13, borderRadius: 12, marginVertical: 4 },
  primaryText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.45 },
  card: { backgroundColor: "#0e1626", borderColor: "#1e2b44", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 9 },
  cardTitle: { color: "#fff", fontWeight: "700", fontSize: 14, marginBottom: 4 },
  detail: { color: "#d6e0f2", marginTop: 8, lineHeight: 18 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  small: { backgroundColor: "#24365a", paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, marginTop: 8 },
  danger: { backgroundColor: "#5b2631" },
  smallText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  status: { color: "#f0b45f", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  ok: { color: "#69d7a3" },
  label: { color: "#93a4bd", fontSize: 12, fontWeight: "700", marginTop: 14, marginBottom: 5 },
});
