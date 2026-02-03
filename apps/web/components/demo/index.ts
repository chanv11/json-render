"use client";

export type { ComponentRenderProps, ComponentRegistry } from "./types";
export { useInteractiveState } from "./utils";
export { AntdProvider } from "./antd-provider";

export { Alert } from "./alert";
export { Avatar } from "./avatar";
export { Badge } from "./badge";
export { BarGraph } from "./bar-graph";
export { Button } from "./button";
export { Card } from "./card";
export { Checkbox } from "./checkbox";
export { Divider } from "./divider";
export { Fallback } from "./fallback";
export { Form } from "./form";
export { Grid } from "./grid";
export { Heading } from "./heading";
export { Image } from "./image";
export { Input } from "./input";
export { LineGraph } from "./line-graph";
export { Link } from "./link";
export { Message } from "./message";
export { Progress } from "./progress";
export { Radio } from "./radio";
export { Rating } from "./rating";
export { Select } from "./select";
export { Stack } from "./stack";
export { Switch } from "./switch";
export { Table } from "./table";
export { Text } from "./text";
export { Textarea } from "./textarea";

import type { ComponentRegistry } from "./types";
import { Alert } from "./alert";
import { Avatar } from "./avatar";
import { Badge } from "./badge";
import { BarGraph } from "./bar-graph";
import { Button } from "./button";
import { Card } from "./card";
import { Checkbox } from "./checkbox";
import { Divider } from "./divider";
import { Fallback } from "./fallback";
import { Form } from "./form";
import { Grid } from "./grid";
import { Heading } from "./heading";
import { Image } from "./image";
import { Input } from "./input";
import { LineGraph } from "./line-graph";
import { Link } from "./link";
import { Message } from "./message";
import { Progress } from "./progress";
import { Radio } from "./radio";
import { Rating } from "./rating";
import { Select } from "./select";
import { Stack } from "./stack";
import { Switch } from "./switch";
import { Table } from "./table";
import { Text } from "./text";
import { Textarea } from "./textarea";

export const demoRegistry: ComponentRegistry = {
  Alert,
  Avatar,
  Badge,
  BarGraph,
  Button,
  Card,
  Checkbox,
  Divider,
  Form,
  Grid,
  Heading,
  Image,
  Input,
  LineGraph,
  Link,
  Message,
  Progress,
  Radio,
  Rating,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
};

export const fallbackComponent = Fallback;
