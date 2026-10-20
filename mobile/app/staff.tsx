import React, { useState } from "react";
import { Switch, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { permissions, type Permission } from "@tamiltrade/shared";
import {
  Screen,
  T,
  Card,
  Row,
  Field,
  Button,
  ErrorNotice,
  LoadingSkeleton,
} from "../components/ui";
import { api, post } from "../services/api";
import { useTheme } from "../theme";
type Staff = {
  _id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  permissions: Permission[];
};
export default function Staff() {
  const c = useTheme();
  const q = useQuery({
    queryKey: ["staff"],
    queryFn: () => api<Staff[]>("/auth/staff"),
  });
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [selected, setSelected] = useState<Permission[]>([]),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const update = async (
    member: Staff,
    values: { permissions: Permission[]; active: boolean },
  ) => {
    try {
      await api(`/auth/staff/${member._id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      await q.refetch();
    } catch (e) {
      setError(e);
    }
  };
  return (
    <Screen
      title="Staff & permissions"
      subtitle="Give each person the access they need."
      back
    >
      <ErrorNotice error={q.error ?? error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <LoadingSkeleton />
      ) : (
        q.data?.map((member) => (
          <Card key={member._id}>
            <T size={18} weight="bold">
              {member.name}
            </T>
            <T color={c.muted}>{member.email}</T>
            {member.role === "owner" ? (
              <T color={c.accent}>OWNER · FULL ACCESS</T>
            ) : (
              <>
                <Row>
                  <T>Account enabled</T>
                  <Switch
                    accessibilityLabel={`${member.name} account enabled`}
                    value={member.active}
                    onValueChange={(active) =>
                      void update(member, {
                        active,
                        permissions: member.permissions,
                      })
                    }
                  />
                </Row>
                {permissions.map((p) => (
                  <Row key={p}>
                    <T>{p}</T>
                    <Switch
                      accessibilityLabel={`${member.name} ${p} permission`}
                      value={member.permissions.includes(p)}
                      onValueChange={(on) =>
                        void update(member, {
                          active: member.active,
                          permissions: on
                            ? [...member.permissions, p]
                            : member.permissions.filter((v) => v !== p),
                        })
                      }
                    />
                  </Row>
                ))}
              </>
            )}
          </Card>
        ))
      )}
      <Card>
        <T size={20} weight="bold">
          Add a staff member
        </T>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Initial password · at least 12 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {permissions.map((p) => (
          <Row key={p}>
            <T>{p}</T>
            <Switch
              accessibilityLabel={`New staff ${p} permission`}
              value={selected.includes(p)}
              onValueChange={(on) =>
                setSelected(
                  on ? [...selected, p] : selected.filter((v) => v !== p),
                )
              }
            />
          </Row>
        ))}
        <Button
          title="Create staff account"
          busy={busy}
          onPress={() => {
            setBusy(true);
            setError(undefined);
            void post("/auth/staff", {
              name,
              email,
              password,
              permissions: selected,
            })
              .then(async () => {
                setName("");
                setEmail("");
                setPassword("");
                setSelected([]);
                await q.refetch();
              })
              .catch(setError)
              .finally(() => setBusy(false));
          }}
        />
      </Card>
      <T color={c.muted} size={12}>
        Permission changes revoke the staff member’s active sessions
        immediately.
      </T>
    </Screen>
  );
}
