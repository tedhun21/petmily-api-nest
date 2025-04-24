import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { ChatsService } from './chats.service';
import { GetMessagesInput } from './dto/get-message.dto';
import { GetChatRoomsInput } from './dto/get-chatRooms.dto';
import { UpdateUnreadCount } from './dto/update-unreadCount';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getChatRooms(
    @AuthUser() jwtUser: JwtUser,
    @Query() getChatRoomsInput: GetChatRoomsInput,
  ) {
    return this.chatsService.getChatRooms(jwtUser, getChatRoomsInput);
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-users')
  getChatRoomByUsers(
    @AuthUser() jwtUser: JwtUser,
    @Query('opponentIds') opponentIds: string,
  ) {
    const arrayIds = opponentIds.split(',').map((id) => Number(id));

    return this.chatsService.getChatRoomByUsers(jwtUser, arrayIds);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-counts')
  getUnreadCounts(@AuthUser() jwtUser: JwtUser) {
    return this.chatsService.getUnreadCounts(jwtUser);
  }

  @UseGuards(JwtAuthGuard)
  @Put('unread-counts')
  updateUnreadCount(
    @AuthUser() jwtUser: JwtUser,
    @Query() updateUnreadCountQuery,
    @Body() updateUnreadCount: UpdateUnreadCount,
  ) {
    return this.chatsService.updateUnreadCount(
      jwtUser,
      updateUnreadCountQuery,
      updateUnreadCount,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  findO(
    @AuthUser() jwtUser: JwtUser,
    @Body() createChatRoomInput: { opponentIds: number[] },
  ) {
    const { opponentIds } = createChatRoomInput;
    const arrayIds = opponentIds.map((id) => Number(id));

    return this.chatsService.createChatRoom(jwtUser, arrayIds);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':chatRoomId')
  getChatRoom(
    @AuthUser() jwtUser: JwtUser,
    @Param('chatRoomId', ParseIntPipe) chatRoomId: number,
  ) {
    return this.chatsService.getChatRoom(jwtUser, chatRoomId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':chatRoomId/messages')
  getMessages(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: { chatRoomId: string },
    @Query() getMessagesInput: GetMessagesInput,
  ) {
    return this.chatsService.getMessages(jwtUser, params, getMessagesInput);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':chatRoomId/messages')
  createMessage(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: { chatRoomId: string },
    @Body() message,
  ) {
    return this.chatsService.createMessage(
      +params.chatRoomId,
      jwtUser,
      message,
    );
  }
}
